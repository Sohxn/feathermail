import hashlib
import logging
import os
import re
import threading
from datetime import datetime, timezone
import httpx
import json
from config import Config
from services.supa_auth import SupabaseService


# initialising supabase object
supabase_service = SupabaseService(
    Config.supabase_url,
    Config.supabase_key
)

#HELPER FUNCTIONS
def md2json(mdtext:str) -> dict:
    pattern = r'```json\s*(\{.*?\})\s*'
    match = re.search(pattern, mdtext, re.DOTALL)
    if not match:
        raise ValueError("No Valid JSON found")
    return json.loads(match.group(1))

#remove unnecessary expressions from email body text (HTML tags, URLs, extra whitespace)
def trim_email_body(raw: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', raw)
    text = re.sub(r'https?://\S+', ' ', text)
    text = re.sub(r'mailto:\S+', ' ', text)
    text = re.sub(r'ftp://\S+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

#SHA256 
def generate_content_hash(mail_body: str) -> str:
    return hashlib.sha256(mail_body.encode('utf-8')).hexdigest()


#generate summary key
def generate_job_key(sender_email_id, model_name, prompt_version, content_hash):
    job_key_string = f"{sender_email_id}+|+{model_name}+|+{prompt_version}+|+{content_hash}"
    return job_key_string


#check durable cache 
def cache_check(sender_email_id, model_name, mail_body, prompt_version):
    content_hash = generate_content_hash(mail_body)
    #check cache
    cache_record = supabase_service.search_durable_cache(sender_email_id, model_name, content_hash)
    
    #case: cache hit (if list is not empty)
    if cache_record:
        #fetch summary from cache 
        cached_summary = cache_record[0]['summary_text']
        return cached_summary

    #case: cache miss (list is empty)
    else:
        return None

    
#fetch or generate summary
def fetch_or_generate_summary(job_key: str, email_body: str, sender_email_id: str, model_name: str, content_hash: str, prompt_version: str, user_id: str | None = None):
    if not supabase_service.try_claim_work(job_key):
        return {"status": "processing", "job_key": job_key}

    thread = threading.Thread(
        target=run_summary_worker,
        args=(job_key, email_body, sender_email_id, model_name, content_hash, prompt_version, user_id),
        daemon=True,
    )
    thread.start()
    return {"status": "accepted", "job_key": job_key}


def run_summary_worker(job_key: str, email_body: str, sender_email_id: str, model_name: str, content_hash: str, prompt_version: str, user_id: str | None = None):
    logger = logging.getLogger(__name__)
    try:
        #for downstream processing
        result = call_bitnet_server(email_body)
        if isinstance(result, str):
            summary_text = result
        else:
            #If model client returned structured data, store its raw JSON string
            try:
                summary_text = json.dumps(result, ensure_ascii=False)
            except Exception:
                summary_text = str(result)
        supabase_service.insert_summary(
            job_key,
            sender_email_id,
            model_name,
            content_hash,
            prompt_version,
            summary_text,
            user_id=user_id,
        )
    except Exception as e:
        logger.exception("summary worker failed for job_key=%s: %s", job_key, e)
    finally:
        supabase_service.delete_in_flight_job(job_key)


def call_bitnet_server(email_body: str):
    # Allow overriding the model server URL via env var for tunneling (ngrok) or remote deploys
    base_url = os.getenv("BITNET_SERVER_URL", "http://127.0.0.1:8080")
    path = "/v1/chat/completions"
    timeout = int(os.getenv("SUMMARY_MODEL_TIMEOUT_SECONDS", "45"))

    system_prompt = (
        'You are an email summarisation and extraction engine. Return exactly one minified valid JSON object '
        'with exactly 4 keys in this order: "summary","money","time","actions". Do not output any text '
        'before or after the JSON. Do not output markdown, code fences, labels, explanations, or newline characters. '
        'Replace any line breaks with spaces. JSON KEY RULES- "summary" must be a short plain-text string. '
        '"money" must be one extracted monetary/deal value like "$240" or "". "time" must be one extracted '
        'schedule/deadline value like "3PM, THURSDAY" or "". "actions" must be an array of semantically dry, '
        'response-oriented suggestions describing what the recipient should do next, each action short, neutral, '
        'imperative, no narrative, no emotion, no duplication, no copied full email sentences, and [] if no clear '
        'next step exists. DONOT INVENT FACTS. If uncertain, use empty values.'
    )

    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": email_body},
        ],
        "temperature": 0.1,
        "max_tokens": 150,
        "stream": False,
        "stop": ["}\n", "} "]
    }

    response = httpx.post(f"{base_url}{path}", json=payload, timeout=timeout)
    response.raise_for_status()

    # Print the raw model response to the backend terminal exactly as returned.
    print(response.text, flush=True)

    # converting the string to json -> dict
    # structured_summary = md2json(response.text)

    # print(structured_summary, flush=True)
    # print(type(structured_summary), flush=True)

    # Return raw response text for downstream processing by user
    return response.text






