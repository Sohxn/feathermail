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


supabase_service = SupabaseService(
    Config.supabase_url,
    Config.supabase_key
)


#helper functions
def md2json(mdtext:str) -> dict:
    pattern = r'```json\s*(\{.*?\})\s*'
    match = re.search(pattern, mdtext, re.DOTALL)
    if not match:
        raise ValueError("No JSON found")
    return json.loads(match.group(1))



def trim_email_body(raw: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', raw)
    text = re.sub(r'https?://\S+', ' ', text)
    text = re.sub(r'mailto:\S+', ' ', text)
    text = re.sub(r'ftp://\S+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def generate_content_hash(mail_body: str) -> str:
    return hashlib.sha256(mail_body.encode('utf-8')).hexdigest()


def generate_job_key(sender_email_id, model_name, prompt_version, content_hash):
    return f"{sender_email_id}+|+{model_name}+|+{prompt_version}+|+{content_hash}"


def extract_json_from_response(raw: str) -> str:
    """
    Robustly extract a JSON object from model output regardless of
    whether it is wrapped in markdown fences or preceded/followed
    by conversational text.
    Returns the raw JSON string, or a safe fallback on complete failure.
    """
    # 1. Try to find a JSON object directly in the string
    #    Match the first { ... } block, allowing nested braces
    brace_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if brace_match:
        candidate = brace_match.group(0).strip()
        try:
            json.loads(candidate)   # validate
            return candidate
        except json.JSONDecodeError:
            pass

    # 2. Strip markdown code fences and retry
    stripped = re.sub(r'```(?:json)?', '', raw).strip().strip('`').strip()
    brace_match2 = re.search(r'\{.*\}', stripped, re.DOTALL)
    if brace_match2:
        candidate2 = brace_match2.group(0).strip()
        try:
            json.loads(candidate2)
            return candidate2
        except json.JSONDecodeError:
            pass

    # 3. Model went fully conversational — return a safe empty structure
    print(f"[summary] could not extract JSON from response, using fallback. raw={raw[:200]}", flush=True)
    return json.dumps({"summary": "", "money": "", "time": "", "actions": []})


def cache_check(sender_email_id, model_name, mail_body, prompt_version):
    content_hash = generate_content_hash(mail_body)
    cache_record = supabase_service.search_durable_cache(sender_email_id, model_name, content_hash)
    if cache_record:
        return cache_record[0]['summary_text']
    return None


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
        raw_result = call_bitnet_server(email_body)
        summary_text = extract_json_from_response(raw_result)
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
    base_url = os.getenv("BITNET_SERVER_URL", "http://127.0.0.1:8080")
    path = "/v1/chat/completions"
    timeout = int(os.getenv("SUMMARY_MODEL_TIMEOUT_SECONDS", "45"))

    #V1
    # system_prompt = (
    #     'You are a JSON-only extraction engine. '
    #     'You MUST respond with exactly one raw JSON object and nothing else. '
    #     'No markdown, no code fences, no explanation, no greeting. '
    #     'Output starts with { and ends with }.'
    # )

    # # Injecting the full instruction into the user turn makes small/quantized
    # # models follow it far more reliably than relying on the system prompt alone.
    # user_message = (
    #     'Extract information from the email below and return ONLY a minified JSON object '
    #     'with exactly these 4 keys: "summary", "money", "time", "actions".\n'
    #     'Rules:\n'
    #     '- "summary": one short plain-text sentence describing the email.\n'
    #     '- "money": one monetary value like "$240" or "" if none.\n'
    #     '- "time": one deadline/schedule like "3PM Thursday" or "" if none.\n'
    #     '- "actions": array of short imperative next steps, or [] if none.\n'
    #     'Do NOT invent facts. Output ONLY the JSON, starting with { and ending with }.\n\n'
    #     f'EMAIL:\n{email_body}'
    # )

    # payload = {
    #     "messages": [
    #         {"role": "system", "content": system_prompt},
    #         {"role": "user",   "content": user_message},
    #     ],
    #     "temperature": 0.0,
    #     "max_tokens": 200,
    #     "stream": False,
    #     # Stop on the closing brace of the top-level object
    #     "stop": ["}\n", "}\n\n", "} \n"],
    # }

    #V2
    prompt = (
        'Return exactly one JSON object with this schema: '
        '{"summary":"string","money":"string","time":"string","actions":["string"]}. '
        'Rules: summary = one short sentence; money = one money value or ""; '
        'time = one deadline/time or ""; actions = array of imperative next steps or []. '
        'Do not add markdown. Do not add explanation. Do not add any text before or after JSON.\n'
        f'EMAIL to summarise:[\n{email_body}]'
    )

    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 160,
        "stream": False,
    }

    response = httpx.post(f"{base_url}{path}", json=payload, timeout=timeout)
    response.raise_for_status()

    #log instantly 
    print(f"response.text: {response.text}", flush=True)
    print(f"type => {type(response.text)}", flush=True)

    print(f"response: {response}", flush=True)
    print(f"type => {type(response)}", flush=True)
    
    return response.text