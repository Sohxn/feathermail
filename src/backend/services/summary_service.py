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


def call_bitnet_server(email_body: str) -> str:
    base_url = os.getenv("BITNET_SERVER_URL", "http://127.0.0.1:8080")
    path = "/v1/chat/completions"
    timeout = int(os.getenv("SUMMARY_MODEL_TIMEOUT_SECONDS", "45"))

    summary_schema = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "money": {"type": "string"},
            "time": {"type": "string"},
            "actions": {
                "type": "array",
                "items": {"type": "string"}
            }
        },
        "required": ["summary", "money", "time", "actions"],
        "additionalProperties": False
    }

    prompt = (
        "Extract information from the email into the required JSON fields. "
        "Do not invent facts. Use empty strings or [] when missing.\n\n"
        f"EMAIL:\n{email_body}"
    )

    payload = {
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0,
        "max_tokens": 160,
        "stream": False,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "schema": summary_schema
            }
        }
    }

    response = httpx.post(f"{base_url}{path}", json=payload, timeout=timeout)
    response.raise_for_status()

    outer = response.json()
    content = outer["choices"][0]["message"]["content"]
    print(f"content: {content}", flush=True)
    return content