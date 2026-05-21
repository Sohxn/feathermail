from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from services.gmail_service import GmailService
from services.supa_auth import SupabaseService
from services.outlook_service import OutlookService
import os
import logging 
from services.gmail_push import GmailPushService
import json 
import base64
from services.imap_service import ImapService
from services.summary_service import (
    trim_email_body,
    generate_content_hash,
    generate_job_key,
    cache_check,
    fetch_or_generate_summary,
)
import threading
import gc
import time #just in case 
from datetime import datetime, timedelta #ok i definitely need this 
import re

#testing
app = Flask(__name__)
allowed_origins_frontend = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8080').split(',')
CORS(app, origins=allowed_origins_frontend)

# # envs
# print("URL:", os.getenv("SUPABASE_URL"))
# print("KEY:", os.getenv("SUPABASE_SERVICE_KEY"))

#init GMAIL
gmail_service = GmailService(
    Config.google_client_id,
    Config.google_client_secret,
    Config.redirect_uri
)

#init IMAP
imap_service = ImapService()

#init SUPABASE (database)
supabase_service = SupabaseService(
    Config.supabase_url,
    Config.supabase_key
)

# init OUTLOOK
outlook_service = OutlookService(
    Config.microsoft_client_id,
    Config.microsoft_client_secret,
    Config.microsoft_redirect_uri,
    getattr(Config, 'microsoft_tenant_id', 'common') or 'common',
)





# settings configuration
PROVIDER_SETTINGS = {
    'yahoo': {
        'imap_host': 'imap.mail.yahoo.com',
        'imap_port': 993,
        'smtp_host': 'smtp.mail.yahoo.com',
        'smtp_port': 465,
    },
    'outlook': {
        'imap_host': 'outlook.office365.com',
        'imap_port': 993,
        'smtp_host': 'smtp.office365.com',
        'smtp_port': 587,
    },
    'imap': {
    #    empty now
    },
}


#### CHECKS #####
# 1.
# ── HEALTH ────────────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'pigeon-backend'})

# 2.
# RENDER CRON JOB TO KEEP GMAIL WATCH AWAKE

# NOTE: remove the cron job when stable and replace with self contained flask function 
# 
#  
@app.route('/api/gmail/renew-watches', methods=['POST'])
def renew_watches():
    """Call this daily to keep push notifications alive."""
    try:
        accounts = supabase_service.client.table('email_accounts')\
            .select('*')\
            .eq('is_connected', True)\
            .execute()
        
        push_service = GmailPushService(gmail_service)
        renewed = 0
        
        for account in accounts.data:
            push_service.watch_inbox(
                user_email=account['email_address'],
                access_token=account['access_token'],
                refresh_token=account['refresh_token']
            )
            renewed += 1
        
        return jsonify({'success': True, 'renewed': renewed})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500






# ── OAUTH CALLBACK ────────────────────────────────────────────────────────
@app.route('/api/gmail/oauth/callback', methods=['POST'])
def gmail_oauth_callback():
    """Exchange OAuth code for tokens and create/update email_account row."""
    try:
        data = request.json
        code = data['code']
        user_id = data['user_id']

        tokens = gmail_service.exchange_code_for_tokens(code)

        existing = supabase_service.client.table('email_accounts')\
            .select('id')\
            .eq('user_id', user_id)\
            .execute()

        is_first = len(existing.data) == 0
        print("first account — marking as primary" if is_first else "additional account", flush=True)

        existing_account = supabase_service.client.table('email_accounts')\
            .select('id,last_history_id')\
            .eq('user_id', user_id)\
            .eq('email_address', tokens['gmail_email'])\
            .limit(1)\
            .execute()

        existing_account_row = existing_account.data[0] if existing_account.data else None
        had_history = bool(existing_account_row and existing_account_row.get('last_history_id'))

        account_data = {
            'user_id': user_id,
            'email_address': tokens['gmail_email'],
            'provider': 'gmail',
            'access_token': tokens['access_token'],
            'refresh_token': tokens['refresh_token'],
            'token_expiry': tokens['token_expiry'],
            'is_primary': is_first,
            'is_connected': True,
            # New account should start with no history marker so initial sync performs full backfill.
            'last_history_id': str(existing_account_row['last_history_id']) if had_history else None,
        }

        result = supabase_service.client.table('email_accounts')\
            .upsert(account_data, on_conflict='user_id,email_address')\
            .execute()

        #enable push notifications for this account when user connects
        push_service = GmailPushService(gmail_service)
        push_service.watch_inbox(
            user_email=tokens['gmail_email'],
            access_token=tokens['access_token'],
            refresh_token=tokens['refresh_token']
        )

        # For newly connected accounts (or accounts without a stored history marker),
        # backfill historical emails asynchronously so UI stays responsive.
        if not had_history:
            thread_account = result.data[0]
            threading.Thread(
                target=run_initial_gmail_backfill,
                args=(user_id, thread_account),
                daemon=True,
            ).start()

        return jsonify({
            'success': True,
            'gmail_email': tokens['gmail_email'],
            'account_id': result.data[0]['id']
        })

    except Exception as e:
        print(f'OAuth error: {e}', flush=True)
        return jsonify({'success': False, 'error': str(e)}), 400


# ── SYNC ──────────────────────────────────────────────────────────────────
def run_initial_gmail_backfill(user_id: str, account: dict):
    """Backfill newly connected Gmail accounts in chunks."""
    try:
        account_id    = account['id']
        email_address = account['email_address']
        access_token  = account['access_token']
        refresh_token = account['refresh_token']

        print(f"{email_address}: collecting message IDs for backfill...", flush=True)
        all_message_ids = []
        page_token = None

        service = gmail_service.get_gmail_service(access_token, refresh_token)

        while True:
            one_month_ago = (datetime.utcnow() - timedelta(days=30)).strftime('%Y/%m/%d')
            kwargs = {
                'userId': 'me',
                'q': f'in:inbox after:{one_month_ago}',
                'maxResults': 500,
            }
            if page_token:
                kwargs['pageToken'] = page_token

            results = service.users().messages().list(**kwargs).execute()
            messages = results.get('messages', [])
            all_message_ids.extend(msg['id'] for msg in messages)

            page_token = results.get('nextPageToken')
            if not page_token:
                break

        total_ids = len(all_message_ids)
        print(f"{email_address}: found {total_ids} messages to backfill", flush=True)

        CHUNK_SIZE   = 25   # emails fetched in parallel per round
        MAX_WORKERS  = 2    # threads — safe for 0.5 CPU / 512MB RAM
        SLEEP_SECS   = 2    # pause between chunks

        total_saved  = 0
        history_id   = None

        for i in range(0, total_ids, CHUNK_SIZE):
            chunk_ids = all_message_ids[i : i + CHUNK_SIZE]

            emails = gmail_service.fetch_details_parallel(
                access_token,
                refresh_token,
                chunk_ids,
                max_workers=MAX_WORKERS,
            )

            for email_data in emails:
                email_data['user_id']   = user_id
                email_data['account_id'] = account_id

            if emails:
                saved = supabase_service.save_emails_batch(emails)
                total_saved += len(saved) if saved else 0

            chunk_num = (i // CHUNK_SIZE) + 1
            total_chunks = (total_ids + CHUNK_SIZE - 1) // CHUNK_SIZE
            print(
                f"{email_address}: backfill chunk {chunk_num}/{total_chunks} "
                f"— {total_saved} saved so far",
                flush=True,
            )

            del emails
            gc.collect()

            time.sleep(SLEEP_SECS)

        profile  = service.users().getProfile(userId='me').execute()
        history_id = profile.get('historyId')

        if history_id:
            supabase_service.update_account_history_id(
                account_id,
                history_id,
                email_address=email_address,
            )

        print(
            f"{email_address}: backfill complete — {total_saved} emails saved",
            flush=True,
        )

        supabase_service.client.table('email_accounts')\
            .update({'backfill_complete': True})\
            .eq('id', account_id)\
            .execute()

    except Exception as e:
        print(f"Backfill error for {account.get('email_address', 'unknown')}: {e}", flush=True)


# 1. GOOGLE 
@app.route('/api/gmail/sync', methods=['POST'])
def sync_gmail():
    """
    Smart sync per account:
      - Has last_history_id  ->  incremental (only new emails, ~1 s)
      - No history_id or history expired  ->  full sync of last 50 emails

    All emails saved in ONE batch upsert per account.
    """
    try:
        data = request.json
        user_id = data['user_id']
        account_id = data.get('account_id')

        accounts = (
            [supabase_service.get_email_account(account_id)]
            if account_id
            else supabase_service.get_user_email_accounts(user_id)
        )

        total_saved = 0

        for account in accounts: 
            email_address = account.get('email_address', account['id'])
            history_id = account.get('last_history_id')

            # Check if this account actually has emails in the DB
            # existing = supabase_service.client.table('emails')\
            #     .select('id')\
            #     .eq('account_id', account['id'])\
            #     .limit(1)\
            #     .execute()
            # has_emails = len(existing.data) > 0


            # Choose sync strategy
            # Only do incremental if we BOTH have a history_id i.e if it has mails already
            # If the DB was wiped or fresh account, force a full sync.
            if history_id:
                result = gmail_service.fetch_emails_incremental(
                    access_token=account['access_token'],
                    refresh_token=account['refresh_token'],
                    start_history_id=history_id
                )
                if result is None:
                    print(f"{email_address}: history expired, falling back to full sync", flush=True)
                    result = gmail_service.fetch_emails_full(
                        access_token=account['access_token'],
                        refresh_token=account['refresh_token'],
                        max_results=50
                    )

            # fix no emails in db (corner case)
            else:
                print(f"{email_address}: no emails in DB — full fetch", flush=True)
                result = gmail_service.fetch_emails_full(
                    access_token=account['access_token'],
                    refresh_token=account['refresh_token'],
                    max_results=100
                )



            # ── Stamp each email with user/account IDs ────────────────────
            emails_to_save = []
            for email_data in result['emails']:
                email_data['user_id'] = user_id
                email_data['account_id'] = account['id']
                emails_to_save.append(email_data)

            # ── ONE batch upsert — not N individual requests ──────────────
            if emails_to_save:
                saved = supabase_service.save_emails_batch(emails_to_save)
                total_saved += len(saved) if saved else 0

            # ── Persist new history_id for next incremental sync ──────────
            if result.get('history_id'):
                supabase_service.update_account_history_id(
                    account['id'],
                    result['history_id'],
                    email_address=email_address
                )

            sync_type = "full" if result.get('is_full_sync') else "incremental"
            print(
                f"{email_address}: {sync_type} sync — "
                f"{len(emails_to_save)} emails, historyId={result.get('history_id')}", flush=True
            )

        return jsonify({
            'success': True,
            'synced': total_saved,
            'accounts_synced': len(accounts)
        })

    except Exception as e:
        print(f'Sync error: {e}', flush=True)
        return jsonify({'error': str(e)}), 500

# other providers
@app.route('/api/imap/connect', methods=['POST'])
def connect_imap():
    """
    1.Test IMAP credentials 
    2.If they work, save the account to the DB.
    3.Expected JSON body:
    {
        "user_id":   "...",
        "provider":  "yahoo" | "outlook" | "imap",
        "email":     "user@example.com",
        "password":  "app-password-here",
 
        // Only required when provider == "imap" (custom domain):
        "imap_host": "imap.example.com",
        "imap_port": 993,
        "smtp_host": "smtp.example.com",
        "smtp_port": 465
    }
    """
    try:
        data     = request.json
        user_id  = data['user_id']
        provider = data['provider']          # 'yahoo' | 'outlook' | 'imap'
        email    = data['email']
        password = data['password']
 
        # Resolve server settings
        if provider in PROVIDER_SETTINGS and PROVIDER_SETTINGS[provider]:
            settings = PROVIDER_SETTINGS[provider]
        else:
            # Custom domain — user must supply all four values
            settings = {
                'imap_host': data['imap_host'],
                'imap_port': int(data.get('imap_port', 993)),
                'smtp_host': data['smtp_host'],
                'smtp_port': int(data.get('smtp_port', 465)),
            }
 
        imap_host = settings['imap_host']
        imap_port = settings['imap_port']
        smtp_host = settings['smtp_host']
        smtp_port = settings['smtp_port']
 
        ok, err_msg = imap_service.test_connection(imap_host, imap_port, email, password)
        if not ok:
            return jsonify({'success': False, 'error': err_msg}), 400
 
        existing = supabase_service.client.table('email_accounts') \
            .select('id') \
            .eq('user_id', user_id) \
            .execute()
        is_first = len(existing.data) == 0
 
        account_data = {
            'user_id':       user_id,
            'email_address': email,
            'provider':      provider,
            'password':      password,
            'imap_host':     imap_host,
            'imap_port':     imap_port,
            'smtp_host':     smtp_host,
            'smtp_port':     smtp_port,
            'is_primary':    is_first,
            'is_connected':  True,
        }
 
        result = supabase_service.client.table('email_accounts') \
            .upsert(account_data, on_conflict='user_id,email_address') \
            .execute()
 
        account_id = result.data[0]['id']
        print(f"IMAP account saved: {email} ({provider}), id={account_id}", flush=True)
 
        return jsonify({'success': True, 'account_id': account_id, 'email': email})
 
    except Exception as e:
        print(f'IMAP connect error: {e}', flush=True)
        return jsonify({'success': False, 'error': str(e)}), 500
 
 
@app.route('/api/imap/sync', methods=['POST'])
def sync_imap():
    """
    Fetch new emails for one (or all) IMAP accounts belonging to a user.
 
    Expected JSON body:
    {
        "user_id":    "...",
        "account_id": "..."   // optional — omit to sync all IMAP accounts
    }
    """
    try:
        data       = request.json
        user_id    = data['user_id']
        account_id = data.get('account_id')
 
        # Load the target account(s)
        if account_id:
            accounts = [supabase_service.get_email_account(account_id)]
        else:
            # Only IMAP-compatible accounts. Outlook is synced via Microsoft Graph.
            all_accounts = supabase_service.get_user_email_accounts(user_id)
            accounts = [a for a in all_accounts if a.get('provider') in {'yahoo', 'imap'}]
 
        if not accounts:
            return jsonify({'success': True, 'synced': 0, 'accounts_synced': 0})
 
        total_saved = 0
 
        for account in accounts:
            email_address = account['email_address']
 
            # ── Fetch emails via IMAP ──────────────────────────────────────
            result = imap_service.fetch_emails(
                host     = account['imap_host'],
                port     = account['imap_port'],
                username = email_address,
                password = account['password'],
                max_results = 50,
            )
 
            # ── Stamp each email with user/account IDs ─────────────────────
            emails_to_save = []
            for email_data in result['emails']:
                email_data['user_id']    = user_id
                email_data['account_id'] = account['id']
                emails_to_save.append(email_data)
 
            # ── Batch upsert ───────────────────────────────────────────────
            if emails_to_save:
                saved = supabase_service.save_emails_batch(emails_to_save)
                total_saved += len(saved) if saved else 0
 
            # Update last_sync timestamp
            supabase_service.client.table('email_accounts') \
                .update({'last_sync': supabase_service._now_iso()}) \
                .eq('id', account['id']) \
                .execute()
 
            print(f"IMAP sync: {email_address} — {len(emails_to_save)} emails", flush=True)
 
        return jsonify({
            'success': True,
            'synced': total_saved,
            'accounts_synced': len(accounts),
        })
 
    except Exception as e:
        print(f'IMAP sync error: {e}', flush=True)
        return jsonify({'error': str(e)}), 500




# ── GET EMAILS ────────────────────────────────────────────────────────────

@app.route('/api/emails', methods=['GET'])
def get_emails():
    """Return emails from the database — fast, no Gmail API call."""
    try:
        user_id = request.args.get('user_id')
        account_id = request.args.get('account_id')
        limit = int(request.args.get('limit', 100))

        emails = (
            supabase_service.get_emails_by_account(account_id, limit)
            if account_id
            else supabase_service.get_emails(user_id, limit)
        )
        return jsonify({'success': True, 'emails': emails})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── SEND EMAIL ────────────────────────────────────────────────────────────

@app.route('/api/gmail/send', methods=['POST'])
def send_email():
    """Send an email via Gmail API."""
    try:
        data = request.json
        user_id = data['user_id']
        tokens = supabase_service.get_gmail_tokens(user_id)
        result = gmail_service.send_email(
            access_token=tokens['access_token'],
            refresh_token=tokens['refresh_token'],
            to=data['to'],
            subject=data['subject'],
            body=data['body']
        )
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/gmail/webhook', methods=['POST'])
def gmail_webhook():
    """
    Gmail POSTs here when new email arrives.
    This is INSTANT - no polling needed!
    """
    try:
        # Get notification from Gmail
        notification = request.json
        
        # Decode the Pub/Sub message
        message = json.loads(
            base64.b64decode(notification['message']['data']).decode()
        )
        
        email_address = message['emailAddress']
        history_id = message['historyId']
        
        # Get user from database — do NOT use .single() as it throws when 0 results
        accounts = supabase_service.client.table('email_accounts')\
            .select('*')\
            .eq('email_address', email_address)\
            .execute()
        
        if not accounts.data or len(accounts.data) == 0:
            return 'OK', 200  # Unknown user, ignore
        
        account = accounts.data[0]
        
        # Fetch only NEW emails using incremental sync
        if not account.get('last_history_id'):
            supabase_service.update_account_history_id(
                account['id'],
                history_id,
                account['email_address']
            )
            return 'OK', 200

        result = gmail_service.fetch_emails_incremental(
            access_token=account['access_token'],
            refresh_token=account['refresh_token'],
            start_history_id=account['last_history_id']
        )
        
        # Save new emails to database
        if result and result.get('emails'):
            for email_data in result['emails']:
                email_data['user_id'] = account['user_id']
                email_data['account_id'] = account['id']
            
            saved_emails = supabase_service.save_emails_batch(result['emails'])
            saved_email_by_gmail_id = {
                row.get('gmail_id'): row
                for row in saved_emails
                if row.get('gmail_id')
            }

            # Summarisation for each newly received email body
            for email_data in result['emails']:
                raw_email_body = email_data.get('body_text') or ''
                if not raw_email_body:
                    print(f"Skipping summary for {email_data.get('id', 'unknown')} — no body_text", flush=True)
                    continue

                saved_email = saved_email_by_gmail_id.get(email_data.get('gmail_id'))
                if not saved_email:
                    print(f"Skipping summary for {email_data.get('gmail_id', 'unknown')} — saved row not found", flush=True)
                    continue

                email_body = trim_email_body(raw_email_body)

                sender_email = account['email_address']
                model_name = 'bitnet'
                prompt_version = 'v1'
                content_hash = generate_content_hash(email_body)
                job_key = generate_job_key(sender_email, model_name, prompt_version, content_hash)

                print(
                    f"Starting summary job for {sender_email} email={email_data.get('id', 'unknown')} job_key={job_key}",
                    flush=True,
                )
                fetch_or_generate_summary(
                    job_key,
                    email_body,
                    saved_email['id'],
                    model_name,
                    content_hash,
                    prompt_version,
                    user_id=account['user_id'],
                )
            
            # Update history ID
            supabase_service.update_account_history_id(
                account['id'],
                history_id,
                email_address
            )
        
        return 'OK', 200
    
    except Exception as e:
        print(f'Webhook error: {e}', flush=True)
        return 'ERROR', 500


# ── OUTLOOK OAUTH CALLBACK ───────────────────────────────────────────────
@app.route('/api/outlook/oauth/callback', methods=['POST'])
def outlook_oauth_callback():
    """Exchange OAuth code for tokens and save email_account row."""
    try:
        data    = request.json
        code    = data['code']
        user_id = data['user_id']

        tokens = outlook_service.exchange_code_for_tokens(code)

        existing = supabase_service.client.table('email_accounts')\
            .select('id')\
            .eq('user_id', user_id)\
            .execute()
        is_first = len(existing.data) == 0

        account_data = {
            'user_id':       user_id,
            'email_address': tokens['email'],
            'provider':      'outlook',
            'access_token':  tokens['access_token'],
            'refresh_token': tokens['refresh_token'],
            'token_expiry':  tokens['token_expiry'],
            'is_primary':    is_first,
            'is_connected':  True,
        }

        result = supabase_service.client.table('email_accounts')\
            .upsert(account_data, on_conflict='user_id,email_address')\
            .execute()

        account_id = result.data[0]['id']

        # Backfill in background
        threading.Thread(
            target=_run_outlook_backfill,
            args=(user_id, result.data[0]),
            daemon=True,
        ).start()

        return jsonify({
            'success':    True,
            'email':      tokens['email'],
            'account_id': account_id,
        })

    except Exception as e:
        print(f'Outlook OAuth error: {e}', flush=True)
        return jsonify({'success': False, 'error': str(e)}), 400


def _run_outlook_backfill(user_id: str, account: dict):
    """Fetch last 100 inbox emails for a newly connected Outlook account."""
    try:
        result = outlook_service.fetch_emails_full(
            access_token=account['access_token'],
            refresh_token=account['refresh_token'],
            max_results=100,
        )
        emails_to_save = []
        for email_data in result['emails']:
            email_data['user_id']    = user_id
            email_data['account_id'] = account['id']
            emails_to_save.append(email_data)

        if emails_to_save:
            supabase_service.save_emails_batch(emails_to_save)

        supabase_service.client.table('email_accounts')\
            .update({'backfill_complete': True})\
            .eq('id', account['id'])\
            .execute()

        print(f"Outlook backfill complete for {account['email_address']}", flush=True)
    except Exception as e:
        print(f"Outlook backfill error: {e}", flush=True)


# ── OUTLOOK SYNC ─────────────────────────────────────────────────────────-
@app.route('/api/outlook/sync', methods=['POST'])
def sync_outlook():
    """Delta sync for Outlook accounts."""
    try:
        data    = request.json
        user_id = data['user_id']
        account_id = data.get('account_id')

        all_accounts = supabase_service.get_user_email_accounts(user_id)
        accounts = [a for a in all_accounts if a.get('provider') == 'outlook']
        if account_id:
            accounts = [a for a in accounts if a['id'] == account_id]

        total_saved = 0

        for account in accounts:
            delta_link = account.get('last_history_id')

            result = outlook_service.fetch_emails_delta(
                access_token=account['access_token'],
                delta_link=delta_link,
            )

            emails_to_save = []
            for email_data in result['emails']:
                email_data['user_id']    = user_id
                email_data['account_id'] = account['id']
                emails_to_save.append(email_data)

            if emails_to_save:
                saved = supabase_service.save_emails_batch(emails_to_save)
                total_saved += len(saved) if saved else 0

            if result.get('delta_link'):
                supabase_service.update_account_history_id(
                    account['id'],
                    result['delta_link'],
                    email_address=account['email_address'],
                )

        return jsonify({'success': True, 'synced': total_saved})

    except Exception as e:
        print(f'Outlook sync error: {e}', flush=True)
        return jsonify({'error': str(e)}), 500



# ── OUTLOOK SEND ─────────────────────────────────────────────────────────-
@app.route('/api/outlook/send', methods=['POST'])
def send_outlook_email():
    """Send an email via Microsoft Graph."""
    try:
        data       = request.json
        account_id = data.get('account_id')
        account    = supabase_service.get_email_account(account_id)

        result = outlook_service.send_email(
            access_token=account['access_token'],
            to=data['to'],
            subject=data['subject'],
            body=data['body'],
        )
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500



# summarisation endpoint
@app.route('/api/summarize', methods=['POST'])
def summarize():
    data = request.get_json(silent=True) or {}
    email_body = data.get('email_body')
    email_id = data.get('email_id') or data.get('sender_id')
    model_name = data.get('model_name', 'bitnet')
    prompt_version = data.get('prompt_version', 'v1')

    if not email_body or not email_id:
        return jsonify({'error': 'email_body and email_id are required'}), 400

    cached_summary = cache_check(email_id, model_name, email_body, prompt_version)
    if cached_summary:
        return jsonify({'status': 'cached', 'summary': cached_summary}), 200

    content_hash = generate_content_hash(email_body)
    job_key = generate_job_key(email_id, model_name, prompt_version, content_hash)

    result = fetch_or_generate_summary(job_key, email_body, email_id, model_name, content_hash, prompt_version)
    return jsonify(result), 202



if __name__ == '__main__':
    import os
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    print(f" Starting Flask development server on port {port}")
    print(f" Debug mode: {debug}", flush=True)
    
    app.run(host='0.0.0.0',port=port,debug=debug)