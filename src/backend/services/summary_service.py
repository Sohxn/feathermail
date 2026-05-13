import hashlib
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
def fetch_or_generate_summary():
    #check if the same summary is in flight
    
