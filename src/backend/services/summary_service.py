import hashlib
import logging
import os
import threading
from datetime import datetime, timezone

import httpx

from config import Config
from services.supa_auth import SupabaseService


# initialising supabase object
supabase_service = SupabaseService(
    Config.supabase_url,
    Config.supabase_key
)


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
def fetch_or_generate_summary(job_key: str, email_body: str, sender_email_id: str, model_name: str, content_hash: str, prompt_version: str):
    if not supabase_service.try_claim_work(job_key):
        return {"status": "processing", "job_key": job_key}

    thread = threading.Thread(
        target=run_summary_worker,
        args=(job_key, email_body, sender_email_id, model_name, content_hash, prompt_version),
        daemon=True,
    )
    thread.start()
    return {"status": "accepted", "job_key": job_key}


def run_summary_worker(job_key: str, email_body: str, sender_email_id: str, model_name: str, content_hash: str, prompt_version: str):
    logger = logging.getLogger(__name__)
    try:
        result = call_bitnet_server(email_body)
        summary_text = result.get("summary") or result.get("response") or result.get("text") or ""
        supabase_service.insert_summary(
            job_key,
            sender_email_id,
            model_name,
            content_hash,
            prompt_version,
            summary_text,
        )
    except Exception as e:
        logger.exception("summary worker failed for job_key=%s: %s", job_key, e)
    finally:
        supabase_service.delete_in_flight_job(job_key)


def call_bitnet_server(email_body: str):
    base_url = os.getenv("BITNET_SERVER_URL", "http://localhost:8000")
    path = os.getenv("BITNET_SERVER_PATH", "/generate")
    timeout = int(os.getenv("SUMMARY_MODEL_TIMEOUT_SECONDS", "45"))

    response = httpx.post(
        f"{base_url}{path}",
        json={"prompt": email_body},
        timeout=timeout,
    )
    response.raise_for_status()

    try:
        return response.json()
    except ValueError:
        return {"text": response.text}






