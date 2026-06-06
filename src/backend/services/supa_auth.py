import time
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client


class SupabaseService:
    def __init__(self, url, key):
        self.url = url
        self.key = key
        self.client: Client = create_client(url, key)

    def _refresh_client(self):
        """Recreate the Supabase client to recover from a dropped HTTP/2 connection."""
        self.client = create_client(self.url, self.key)

    def _now_iso(self) -> str:
        """Return current UTC time as ISO-8601 string for use in Supabase REST calls."""
        return datetime.now(timezone.utc).isoformat()

    # ── EMAIL ACCOUNTS ────────────────────────────────────────────────────

    def save_email_account(self, account_data):
        result = self.client.table('email_accounts').upsert(account_data).execute()
        return result.data

    def get_user_email_accounts(self, user_id):
        result = self.client.table('email_accounts')\
            .select('*')\
            .eq('user_id', user_id)\
            .eq('is_connected', True)\
            .execute()
        return result.data

    def get_email_account(self, account_id):
        result = self.client.table('email_accounts')\
            .select('*')\
            .eq('id', account_id)\
            .single()\
            .execute()
        return result.data

    def get_primary_account(self, user_id):
        result = self.client.table('email_accounts')\
            .select('*')\
            .eq('user_id', user_id)\
            .eq('is_primary', True)\
            .single()\
            .execute()
        return result.data if result.data else None

    def update_account_history_id(self, account_id: str, history_id: str, email_address: str = ''):
        """
        Persist the Gmail historyId after each sync so the next sync is incremental.

        Proactively refreshes the HTTP client first because the preceding batch
        upsert tends to exhaust HTTP/2 stream slots on the existing connection.
        Uses a real ISO-8601 datetime for last_sync — 'NOW()' is a SQL function
        and does NOT get evaluated by the Supabase REST API.
        Retries up to 3 times with exponential back-off (0.5s, 1s, 2s).
        """
        self._refresh_client()  # always start with a fresh connection here

        payload = {
            'last_history_id': str(history_id),
            'last_sync': self._now_iso(),
        }

        for attempt in range(3):
            try:
                self.client.table('email_accounts')\
                    .update(payload)\
                    .eq('id', account_id)\
                    .execute()
                print(f"history_id saved for {email_address or account_id}: {history_id}", flush=True)
                return
            except Exception as e:
                wait = 0.5 * (2 ** attempt)  # 0.5s, 1s, 2s
                print(f"update_account_history_id attempt {attempt + 1} failed: {e} — retrying in {wait}s", flush=True)
                time.sleep(wait)
                self._refresh_client()

        print(f"ERROR: could not save history_id for {email_address or account_id} after 3 attempts", flush=True)

    # ── EMAILS ────────────────────────────────────────────────────────────

    def save_emails_batch(self, emails: list):
        """
        Upsert all emails in a single HTTP request.
        on_conflict='gmail_id' means duplicates are silently updated, never rejected.
        Retries with a fresh connection and back-off on failure.
        """
        if not emails:
            print("[SUPABASE] save_emails_batch called with 0 emails", flush=True)
            return []

        print(
            f"[SUPABASE] save_emails_batch called with {len(emails)} emails; "
            f"sample gmail_id={emails[0].get('gmail_id')} account_id={emails[0].get('account_id')}",
            flush=True, 
        )

        for attempt in range(3):
            try:
                result = self.client.table('emails')\
                    .upsert(emails, on_conflict='gmail_id')\
                    .execute()
                rows = result.data or []
                print(
                    f"[SUPABASE] save_emails_batch attempt {attempt + 1} succeeded; "
                    f"rows_returned={len(rows)}",
                    flush=True,
                )
                return rows
            except Exception as e:
                wait = 0.5 * (2 ** attempt)
                print(
                    f"[SUPABASE] save_emails_batch attempt {attempt + 1} failed: {e} — "
                    f"retrying in {wait}s",
                    flush=True,
                )
                time.sleep(wait)
                self._refresh_client()

        print('[SUPABASE] ERROR: save_emails_batch failed after 3 attempts', flush=True)
        return []

    def get_emails(self, user_id, limit=100):
        print(f"[SUPABASE] get_emails user_id={user_id} limit={limit}", flush=True)
        result = self.client.table('emails')\
            .select('*, email_accounts(email_address, provider)')\
            .eq('user_id', user_id)\
            .order('received_at', desc=True)\
            .limit(limit)\
            .execute()
        rows = result.data or []
        print(f"[SUPABASE] get_emails returned {len(rows)} rows for user_id={user_id}", flush=True)
        return rows

    def get_emails_by_account(self, account_id, limit=100):
        print(f"[SUPABASE] get_emails_by_account account_id={account_id} limit={limit}", flush=True)
        result = self.client.table('emails')\
            .select('*')\
            .eq('account_id', account_id)\
            .order('received_at', desc=True)\
            .limit(limit)\
            .execute()
        rows = result.data or []
        print(
            f"[SUPABASE] get_emails_by_account returned {len(rows)} rows for account_id={account_id}",
            flush=True,
        )
        return rows

    def update_email_status(self, email_id, updates):
        result = self.client.table('emails')\
            .update(updates)\
            .eq('id', email_id)\
            .execute()
        return result.data


    # SUMMARY RELATED QUERIES
    def search_durable_cache(self, sender_email_id:str, model_name:str, content_hash:str):
        result = self.client.table('summaries')\
            .select('*')\
            .eq('email_id', sender_email_id)\
            .eq('model_name', model_name)\
            .eq('content_hash', content_hash)\
            .gt('expires_at', self._now_iso())\
            .execute()

        return result.data

    def try_claim_work(self, job_key: str, ttl_minutes: int = 5):
        expiry_time = (datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)).isoformat()
        row = {
            "job_key": job_key,
            "status": "running",
            "expires_at": expiry_time,
        }

        try:
            self.client.table('in_flight_jobs').insert(row).execute()
            return True
        except Exception as e:
            msg = str(e).lower()
            if "duplicate key" in msg or "23505" in msg or "conflict" in msg:
                return False
            raise

    def insert_summary(self, job_key: str, sender_email_id: str, model_name: str, content_hash: str, prompt_version: str, summary_text: str, user_id: str | None = None, ttl_days: int = 30):
        expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()
        row = {
            "job_key": job_key,
            "user_id": user_id,
            "email_id": sender_email_id,
            "model_name": model_name,
            "content_hash": content_hash,
            "prompt_version": prompt_version,
            "summary_text": summary_text,
            "status": "completed",
            "expires_at": expires_at,
            "created_at": self._now_iso(),
        }

        existing = self.client.table('summaries')\
            .select('id')\
            .eq('email_id', sender_email_id)\
            .eq('model_name', model_name)\
            .eq('content_hash', content_hash)\
            .eq('prompt_version', prompt_version)\
            .limit(1)\
            .execute()

        if existing.data:
            summary_id = existing.data[0]['id']
            result = self.client.table('summaries').update(row).eq('id', summary_id).execute()
        else:
            result = self.client.table('summaries').insert(row).execute()

        return result.data

    def get_cached_summary(self, job_key: str):
        result = self.client.table('summaries')\
            .select('*')\
            .eq('job_key', job_key)\
            .limit(1)\
            .execute()
        return result.data[0] if result.data else None

    def get_in_flight_job(self, job_key: str):
        result = self.client.table('in_flight_jobs')\
            .select('*')\
            .eq('job_key', job_key)\
            .limit(1)\
            .execute()
        return result.data[0] if result.data else None

    def delete_in_flight_job(self, job_key: str):
        self.client.table('in_flight_jobs')\
            .delete()\
            .eq('job_key', job_key)\
            .execute()

    # ── LEGACY ────────────────────────────────────────────────────────────

    def get_gmail_tokens(self, user_id):
        account = self.get_primary_account(user_id)
        if not account:
            accounts = self.get_user_email_accounts(user_id)
            account = accounts[0] if accounts else None
        if not account:
            raise Exception("No email account connected")
        return {
            'access_token': account['access_token'],
            'refresh_token': account['refresh_token'],
            'token_expiry': account.get('token_expiry')
        }