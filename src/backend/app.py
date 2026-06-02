# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from config import Config
# from services.gmail_service import GmailService
# from services.supa_auth import SupabaseService
# from services.outlook_service import OutlookService
# import os
# import logging 
# from services.gmail_push import GmailPushService
# import json 
# import base64
# from services.imap_service import ImapService
# from services.summary_service import (
#     trim_email_body,
#     generate_content_hash,
#     generate_job_key,
#     cache_check,
#     fetch_or_generate_summary,
# )
# import threading
# import gc
# import time
# from datetime import datetime, timedelta
# import re

# app = Flask(__name__)
# allowed_origins_frontend = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8080').split(',')
# CORS(app, origins=allowed_origins_frontend)

# #init GMAIL
# gmail_service = GmailService(
#     Config.google_client_id,
#     Config.google_client_secret,
#     Config.redirect_uri
# )

# #init IMAP
# imap_service = ImapService()

# #init SUPABASE (database)
# supabase_service = SupabaseService(
#     Config.supabase_url,
#     Config.supabase_key
# )

# # init OUTLOOK
# outlook_service = OutlookService(
#     Config.microsoft_client_id,
#     Config.microsoft_client_secret,
#     Config.microsoft_redirect_uri,
#     getattr(Config, 'microsoft_tenant_id', 'common') or 'common',
# )

# OUTLOOK_SUBSCRIPTION_TTL_MINUTES = int(os.getenv('OUTLOOK_SUBSCRIPTION_TTL_MINUTES', '4200'))


# def _save_outlook_emails(user_id: str, account: dict, emails: list[dict]) -> list[dict]:
#     if not emails:
#         return []
#     emails_to_save = []
#     for email_data in emails:
#         email_data['user_id'] = user_id
#         email_data['account_id'] = account['id']
#         emails_to_save.append(email_data)
#     return supabase_service.save_emails_batch(emails_to_save)


# def _sync_outlook_account(user_id: str, account: dict, force_full: bool = False) -> tuple[int, str | None]:
#     """
#     Sync one Outlook account.

#     Strategy:
#     - If force_full=True OR no delta link stored → call fetch_emails_full (paginated REST query)
#       then persist the fresh delta link returned by that call.
#     - Otherwise → call fetch_emails_delta with the stored delta link.
#       If the cursor has expired (404/410) fall back to fetch_emails_full.

#     Returns (emails_saved, new_delta_link).
#     """
#     email_address = account.get('email_address', account['id'])
#     stored_delta  = account.get('last_history_id')  # we reuse this column for the Outlook delta link

#     access_token  = account['access_token']
#     refresh_token = account.get('refresh_token')
#     token_expiry  = account.get('token_expiry')

#     result = None

#     # ── Try delta (incremental) sync first ───────────────────────────────
#     if not force_full and stored_delta:
#         print(f"{email_address}: trying incremental Outlook sync", flush=True)
#         result = outlook_service.fetch_emails_delta(
#             access_token=access_token,
#             refresh_token=refresh_token,
#             token_expiry=token_expiry,
#             delta_link=stored_delta,
#         )
#         if result is None:
#             print(f"{email_address}: delta cursor expired, falling back to full sync", flush=True)

#     # ── Full sync (backfill or fallback) ─────────────────────────────────
#     if result is None:
#         print(f"{email_address}: running full Outlook sync", flush=True)
#         result = outlook_service.fetch_emails_full(
#             access_token=access_token,
#             refresh_token=refresh_token,
#             token_expiry=token_expiry,
#             max_results=100,
#         )
# #  s
#     if not result:
#         print(f"{email_address}: Outlook sync returned no result", flush=True)
#         return 0, None

#     emails  = result.get('emails', [])
#     new_delta = result.get('delta_link')

#     saved_rows = _save_outlook_emails(user_id, account, emails)
#     saved_count = len(saved_rows) if saved_rows else 0

#     print(
#         f"{email_address}: Outlook sync saved {saved_count}/{len(emails)} emails, "
#         f"delta_link={'yes' if new_delta else 'no'}",
#         flush=True,
#     )

#     # Persist the new delta link so the next sync is incremental
#     if new_delta:
#         supabase_service.update_account_history_id(
#             account['id'],
#             new_delta,
#             email_address=email_address,
#         )

#     return saved_count, new_delta


# # ── Provider settings ─────────────────────────────────────────────────────
# PROVIDER_SETTINGS = {
#     'yahoo': {
#         'imap_host': 'imap.mail.yahoo.com',
#         'imap_port': 993,
#         'smtp_host': 'smtp.mail.yahoo.com',
#         'smtp_port': 465,
#     },
#     'outlook': {
#         'imap_host': 'outlook.office365.com',
#         'imap_port': 993,
#         'smtp_host': 'smtp.office365.com',
#         'smtp_port': 587,
#     },
#     'imap': {},
# }


# # ── HEALTH ────────────────────────────────────────────────────────────────
# @app.route('/health', methods=['GET'])
# def health():
#     return jsonify({'status': 'healthy', 'service': 'pigeon-backend'})


# @app.route('/api/gmail/renew-watches', methods=['POST'])
# def renew_watches():
#     """Call this daily to keep push notifications alive."""
#     try:
#         accounts = supabase_service.client.table('email_accounts')\
#             .select('*')\
#             .eq('is_connected', True)\
#             .execute()
        
#         push_service = GmailPushService(gmail_service)
#         renewed = 0
        
#         for account in accounts.data:
#             push_service.watch_inbox(
#                 user_email=account['email_address'],
#                 access_token=account['access_token'],
#                 refresh_token=account['refresh_token']
#             )
#             renewed += 1
        
#         return jsonify({'success': True, 'renewed': renewed})
#     except Exception as e:
#         return jsonify({'success': False, 'error': str(e)}), 500


# # ── GMAIL OAUTH CALLBACK ──────────────────────────────────────────────────
# @app.route('/api/gmail/oauth/callback', methods=['POST'])
# def gmail_oauth_callback():
#     try:
#         data = request.json
#         code = data['code']
#         user_id = data['user_id']

#         tokens = gmail_service.exchange_code_for_tokens(code)

#         existing = supabase_service.client.table('email_accounts')\
#             .select('id')\
#             .eq('user_id', user_id)\
#             .execute()

#         is_first = len(existing.data) == 0

#         existing_account = supabase_service.client.table('email_accounts')\
#             .select('id,last_history_id')\
#             .eq('user_id', user_id)\
#             .eq('email_address', tokens['gmail_email'])\
#             .limit(1)\
#             .execute()

#         existing_account_row = existing_account.data[0] if existing_account.data else None
#         had_history = bool(existing_account_row and existing_account_row.get('last_history_id'))

#         account_data = {
#             'user_id': user_id,
#             'email_address': tokens['gmail_email'],
#             'provider': 'gmail',
#             'access_token': tokens['access_token'],
#             'refresh_token': tokens['refresh_token'],
#             'token_expiry': tokens['token_expiry'],
#             'is_primary': is_first,
#             'is_connected': True,
#             'backfill_complete': False,
#             'last_history_id': str(existing_account_row['last_history_id']) if had_history else None,
#         }

#         result = supabase_service.client.table('email_accounts')\
#             .upsert(account_data, on_conflict='user_id,email_address')\
#             .execute()

#         push_service = GmailPushService(gmail_service)
#         push_service.watch_inbox(
#             user_email=tokens['gmail_email'],
#             access_token=tokens['access_token'],
#             refresh_token=tokens['refresh_token']
#         )

#         if not had_history:
#             thread_account = result.data[0]
#             threading.Thread(
#                 target=run_initial_gmail_backfill,
#                 args=(user_id, thread_account),
#                 daemon=True,
#             ).start()

#         return jsonify({
#             'success': True,
#             'gmail_email': tokens['gmail_email'],
#             'account_id': result.data[0]['id']
#         })

#     except Exception as e:
#         print(f'OAuth error: {e}', flush=True)
#         return jsonify({'success': False, 'error': str(e)}), 400


# # ── GMAIL BACKFILL ────────────────────────────────────────────────────────
# def run_initial_gmail_backfill(user_id: str, account: dict):
#     account_id = account.get('id')
#     backfill_succeeded = False
#     try:
#         email_address = account['email_address']
#         access_token  = account['access_token']
#         refresh_token = account['refresh_token']

#         print(f"{email_address}: collecting message IDs for backfill...", flush=True)
#         all_message_ids = []
#         page_token = None

#         service = gmail_service.get_gmail_service(access_token, refresh_token)

#         while True:
#             one_month_ago = (datetime.utcnow() - timedelta(days=30)).strftime('%Y/%m/%d')
#             kwargs = {
#                 'userId': 'me',
#                 'q': f'in:inbox after:{one_month_ago}',
#                 'maxResults': 500,
#             }
#             if page_token:
#                 kwargs['pageToken'] = page_token

#             results = service.users().messages().list(**kwargs).execute()
#             messages = results.get('messages', [])
#             all_message_ids.extend(msg['id'] for msg in messages)

#             page_token = results.get('nextPageToken')
#             if not page_token:
#                 break

#         total_ids = len(all_message_ids)
#         print(f"{email_address}: found {total_ids} messages to backfill", flush=True)

#         CHUNK_SIZE  = 25
#         MAX_WORKERS = 2
#         SLEEP_SECS  = 2

#         total_saved = 0
#         history_id  = None

#         for i in range(0, total_ids, CHUNK_SIZE):
#             chunk_ids = all_message_ids[i : i + CHUNK_SIZE]

#             emails = gmail_service.fetch_details_parallel(
#                 access_token,
#                 refresh_token,
#                 chunk_ids,
#                 max_workers=MAX_WORKERS,
#             )

#             for email_data in emails:
#                 email_data['user_id']    = user_id
#                 email_data['account_id'] = account_id

#             if emails:
#                 saved = supabase_service.save_emails_batch(emails)
#                 total_saved += len(saved) if saved else 0

#             chunk_num    = (i // CHUNK_SIZE) + 1
#             total_chunks = (total_ids + CHUNK_SIZE - 1) // CHUNK_SIZE
#             print(
#                 f"{email_address}: backfill chunk {chunk_num}/{total_chunks} "
#                 f"— {total_saved} saved so far",
#                 flush=True,
#             )

#             del emails
#             gc.collect()
#             time.sleep(SLEEP_SECS)

#         profile    = service.users().getProfile(userId='me').execute()
#         history_id = profile.get('historyId')

#         if history_id:
#             supabase_service.update_account_history_id(
#                 account_id,
#                 history_id,
#                 email_address=email_address,
#             )

#         print(f"{email_address}: backfill complete — {total_saved} emails saved", flush=True)
#         backfill_succeeded = True

#     except Exception as e:
#         print(f"Backfill error for {account.get('email_address', 'unknown')}: {e}", flush=True)
#     finally:
#         if account_id:
#             try:
#                 supabase_service.client.table('email_accounts')\
#                     .update({'backfill_complete': backfill_succeeded})\
#                     .eq('id', account_id)\
#                     .execute()
#             except Exception as e:
#                 print(f"Failed to mark Gmail backfill complete: {e}", flush=True)


# # ── GMAIL SYNC ────────────────────────────────────────────────────────────
# @app.route('/api/gmail/sync', methods=['POST'])
# def sync_gmail():
#     try:
#         data = request.json
#         user_id = data['user_id']
#         account_id = data.get('account_id')

#         accounts = (
#             [supabase_service.get_email_account(account_id)]
#             if account_id
#             else supabase_service.get_user_email_accounts(user_id)
#         )

#         total_saved = 0

#         for account in accounts:
#             email_address = account.get('email_address', account['id'])
#             history_id = account.get('last_history_id')

#             if history_id:
#                 result = gmail_service.fetch_emails_incremental(
#                     access_token=account['access_token'],
#                     refresh_token=account['refresh_token'],
#                     start_history_id=history_id
#                 )
#                 if result is None:
#                     print(f"{email_address}: history expired, falling back to full sync", flush=True)
#                     result = gmail_service.fetch_emails_full(
#                         access_token=account['access_token'],
#                         refresh_token=account['refresh_token'],
#                         max_results=50
#                     )
#             else:
#                 print(f"{email_address}: no history ID — full fetch", flush=True)
#                 result = gmail_service.fetch_emails_full(
#                     access_token=account['access_token'],
#                     refresh_token=account['refresh_token'],
#                     max_results=100
#                 )

#             emails_to_save = []
#             for email_data in result['emails']:
#                 email_data['user_id'] = user_id
#                 email_data['account_id'] = account['id']
#                 emails_to_save.append(email_data)

#             if emails_to_save:
#                 saved = supabase_service.save_emails_batch(emails_to_save)
#                 total_saved += len(saved) if saved else 0

#             if result.get('history_id'):
#                 supabase_service.update_account_history_id(
#                     account['id'],
#                     result['history_id'],
#                     email_address=email_address
#                 )

#             sync_type = "full" if result.get('is_full_sync') else "incremental"
#             print(
#                 f"{email_address}: {sync_type} sync — "
#                 f"{len(emails_to_save)} emails, historyId={result.get('history_id')}", flush=True
#             )

#         return jsonify({
#             'success': True,
#             'synced': total_saved,
#             'accounts_synced': len(accounts)
#         })

#     except Exception as e:
#         print(f'Sync error: {e}', flush=True)
#         return jsonify({'error': str(e)}), 500


# # ── IMAP CONNECT ──────────────────────────────────────────────────────────
# @app.route('/api/imap/connect', methods=['POST'])
# def connect_imap():
#     try:
#         data     = request.json
#         user_id  = data['user_id']
#         provider = data['provider']
#         email    = data['email']
#         password = data['password']

#         if provider in PROVIDER_SETTINGS and PROVIDER_SETTINGS[provider]:
#             settings = PROVIDER_SETTINGS[provider]
#         else:
#             settings = {
#                 'imap_host': data['imap_host'],
#                 'imap_port': int(data.get('imap_port', 993)),
#                 'smtp_host': data['smtp_host'],
#                 'smtp_port': int(data.get('smtp_port', 465)),
#             }

#         imap_host = settings['imap_host']
#         imap_port = settings['imap_port']
#         smtp_host = settings['smtp_host']
#         smtp_port = settings['smtp_port']

#         ok, err_msg = imap_service.test_connection(imap_host, imap_port, email, password)
#         if not ok:
#             return jsonify({'success': False, 'error': err_msg}), 400

#         existing = supabase_service.client.table('email_accounts') \
#             .select('id').eq('user_id', user_id).execute()
#         is_first = len(existing.data) == 0

#         account_data = {
#             'user_id':            user_id,
#             'email_address':      email,
#             'provider':           provider,
#             'password_encrypted': password,
#             'imap_host':          imap_host,
#             'imap_port':          imap_port,
#             'smtp_host':          smtp_host,
#             'smtp_port':          smtp_port,
#             'is_primary':         is_first,
#             'is_connected':       True,
#         }

#         result = supabase_service.client.table('email_accounts') \
#             .upsert(account_data, on_conflict='user_id,email_address').execute()

#         account_id = result.data[0]['id']
#         print(f"IMAP account saved: {email} ({provider}), id={account_id}", flush=True)

#         return jsonify({'success': True, 'account_id': account_id, 'email': email})

#     except Exception as e:
#         print(f'IMAP connect error: {e}', flush=True)
#         return jsonify({'success': False, 'error': str(e)}), 500


# # ── IMAP SYNC ─────────────────────────────────────────────────────────────
# @app.route('/api/imap/sync', methods=['POST'])
# def sync_imap():
#     try:
#         data       = request.json
#         user_id    = data['user_id']
#         account_id = data.get('account_id')

#         if account_id:
#             accounts = [supabase_service.get_email_account(account_id)]
#         else:
#             all_accounts = supabase_service.get_user_email_accounts(user_id)
#             accounts = [a for a in all_accounts if a.get('provider') in {'yahoo', 'imap'}]

#         if not accounts:
#             return jsonify({'success': True, 'synced': 0, 'accounts_synced': 0})

#         total_saved = 0

#         for account in accounts:
#             email_address = account['email_address']

#             result = imap_service.fetch_emails(
#                 host=account['imap_host'],
#                 port=account['imap_port'],
#                 username=email_address,
#                 password=account.get('password_encrypted') or account.get('password'),
#                 max_results=50,
#             )

#             emails_to_save = []
#             for email_data in result['emails']:
#                 email_data['user_id']    = user_id
#                 email_data['account_id'] = account['id']
#                 emails_to_save.append(email_data)

#             if emails_to_save:
#                 saved = supabase_service.save_emails_batch(emails_to_save)
#                 total_saved += len(saved) if saved else 0

#             supabase_service.client.table('email_accounts') \
#                 .update({'last_sync': supabase_service._now_iso()}) \
#                 .eq('id', account['id']).execute()

#             print(f"IMAP sync: {email_address} — {len(emails_to_save)} emails", flush=True)

#         return jsonify({'success': True, 'synced': total_saved, 'accounts_synced': len(accounts)})

#     except Exception as e:
#         print(f'IMAP sync error: {e}', flush=True)
#         return jsonify({'error': str(e)}), 500


# # ── GET EMAILS ────────────────────────────────────────────────────────────
# @app.route('/api/emails', methods=['GET'])
# def get_emails():
#     try:
#         user_id    = request.args.get('user_id')
#         account_id = request.args.get('account_id')
#         limit      = int(request.args.get('limit', 100))

#         emails = (
#             supabase_service.get_emails_by_account(account_id, limit)
#             if account_id
#             else supabase_service.get_emails(user_id, limit)
#         )
#         return jsonify({'success': True, 'emails': emails})

#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# # ── SEND EMAIL ────────────────────────────────────────────────────────────
# @app.route('/api/gmail/send', methods=['POST'])
# def send_email():
#     try:
#         data    = request.json
#         user_id = data['user_id']
#         tokens  = supabase_service.get_gmail_tokens(user_id)
#         result  = gmail_service.send_email(
#             access_token=tokens['access_token'],
#             refresh_token=tokens['refresh_token'],
#             to=data['to'],
#             subject=data['subject'],
#             body=data['body']
#         )
#         return jsonify(result)

#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# # ── GMAIL WEBHOOK ─────────────────────────────────────────────────────────
# @app.route('/api/gmail/webhook', methods=['POST'])
# def gmail_webhook():
#     try:
#         notification = request.json
#         message = json.loads(
#             base64.b64decode(notification['message']['data']).decode()
#         )
#         email_address = message['emailAddress']
#         history_id    = message['historyId']

#         accounts = supabase_service.client.table('email_accounts')\
#             .select('*')\
#             .eq('email_address', email_address)\
#             .execute()

#         if not accounts.data:
#             return 'OK', 200

#         account = accounts.data[0]

#         if not account.get('last_history_id'):
#             supabase_service.update_account_history_id(
#                 account['id'], history_id, account['email_address']
#             )
#             return 'OK', 200

#         result = gmail_service.fetch_emails_incremental(
#             access_token=account['access_token'],
#             refresh_token=account['refresh_token'],
#             start_history_id=account['last_history_id']
#         )

#         if result and result.get('emails'):
#             for email_data in result['emails']:
#                 email_data['user_id']    = account['user_id']
#                 email_data['account_id'] = account['id']

#             saved_emails = supabase_service.save_emails_batch(result['emails'])
#             saved_email_by_gmail_id = {
#                 row.get('gmail_id'): row
#                 for row in saved_emails
#                 if row.get('gmail_id')
#             }

#             for email_data in result['emails']:
#                 raw_email_body = email_data.get('body_text') or ''
#                 if not raw_email_body:
#                     continue

#                 saved_email = saved_email_by_gmail_id.get(email_data.get('gmail_id'))
#                 if not saved_email:
#                     continue

#                 email_body    = trim_email_body(raw_email_body)
#                 sender_email  = account['email_address']
#                 model_name    = 'bitnet'
#                 prompt_version = 'v1'
#                 content_hash  = generate_content_hash(email_body)
#                 job_key       = generate_job_key(sender_email, model_name, prompt_version, content_hash)

#                 fetch_or_generate_summary(
#                     job_key, email_body, saved_email['id'],
#                     model_name, content_hash, prompt_version,
#                     user_id=account['user_id'],
#                 )

#             supabase_service.update_account_history_id(
#                 account['id'], history_id, email_address
#             )

#         return 'OK', 200

#     except Exception as e:
#         print(f'Webhook error: {e}', flush=True)
#         return 'ERROR', 500


# # ── OUTLOOK WEBHOOK ───────────────────────────────────────────────────────
# @app.route('/api/outlook/webhook', methods=['GET', 'POST'])
# def outlook_webhook():
#     try:
#         validation_token = request.args.get('validationToken')
#         if validation_token:
#             return validation_token, 200, {'Content-Type': 'text/plain; charset=utf-8'}

#         payload       = request.json or {}
#         notifications = payload.get('value', []) if isinstance(payload, dict) else []

#         for notification in notifications:
#             account_id = notification.get('clientState')
#             if not account_id:
#                 continue

#             account = supabase_service.get_email_account(account_id)
#             if not account:
#                 continue

#             threading.Thread(
#                 target=_sync_outlook_account,
#                 args=(account['user_id'], account),
#                 daemon=True,
#             ).start()

#         return 'OK', 202

#     except Exception as e:
#         print(f'Outlook webhook error: {e}', flush=True)
#         return 'ERROR', 500


# # ── OUTLOOK OAUTH CALLBACK ────────────────────────────────────────────────
# @app.route('/api/outlook/oauth/callback', methods=['POST'])
# def outlook_oauth_callback():
#     try:
#         data    = request.json
#         code    = data['code']
#         user_id = data['user_id']

#         tokens = outlook_service.exchange_code_for_tokens(code)

#         existing = supabase_service.client.table('email_accounts')\
#             .select('id').eq('user_id', user_id).execute()
#         is_first = len(existing.data) == 0

#         account_data = {
#             'user_id':       user_id,
#             'email_address': tokens['email'],
#             'provider':      'outlook',
#             'access_token':  tokens['access_token'],
#             'refresh_token': tokens['refresh_token'],
#             'token_expiry':  tokens['token_expiry'],
#             'is_primary':    is_first,
#             'is_connected':  True,
#             'backfill_complete': False,
#             # Clear any stale delta link so backfill does a full sync
#             'last_history_id': None,
#         }

#         result = supabase_service.client.table('email_accounts')\
#             .upsert(account_data, on_conflict='user_id,email_address')\
#             .execute()

#         account_row = result.data[0]
#         account_id  = account_row['id']

#         # Backfill in background
#         threading.Thread(
#             target=_run_outlook_backfill,
#             args=(user_id, account_row),
#             daemon=True,
#         ).start()

#         # Webhook subscription is best-effort
#         try:
#             raw_root    = request.url_root.rstrip('/')
#             webhook_url = raw_root.replace('http://', 'https://') + '/api/outlook/webhook'
#             outlook_service.create_inbox_subscription(
#                 access_token=tokens['access_token'],
#                 notification_url=webhook_url,
#                 client_state=account_id,
#                 ttl_minutes=OUTLOOK_SUBSCRIPTION_TTL_MINUTES,
#             )
#             print(f"Outlook subscription created for {tokens['email']}", flush=True)
#         except Exception as sub_err:
#             print(f"Outlook subscription skipped (not critical): {sub_err}", flush=True)

#         return jsonify({'success': True, 'email': tokens['email'], 'account_id': account_id})

#     except Exception as e:
#         print(f'Outlook OAuth error: {e}', flush=True)
#         return jsonify({'success': False, 'error': str(e)}), 400


# def _run_outlook_backfill(user_id: str, account: dict):
#     """Full sync for a newly connected Outlook account."""
#     backfill_succeeded = False
#     try:
#         saved_count, _ = _sync_outlook_account(user_id, account, force_full=True)
#         print(f"Outlook backfill complete for {account['email_address']}: {saved_count} emails saved", flush=True)
#         backfill_succeeded = True
#     except Exception as e:
#         print(f"Outlook backfill error for {account.get('email_address', 'unknown')}: {e}", flush=True)
#     finally:
#         try:
#             supabase_service.client.table('email_accounts')\
#                 .update({'backfill_complete': backfill_succeeded})\
#                 .eq('id', account['id'])\
#                 .execute()
#         except Exception as e:
#             print(f"Failed to mark Outlook backfill complete: {e}", flush=True)


# # ── OUTLOOK SYNC ──────────────────────────────────────────────────────────
# @app.route('/api/outlook/sync', methods=['POST'])
# def sync_outlook():
#     try:
#         data       = request.json
#         user_id    = data['user_id']
#         account_id = data.get('account_id')

#         all_accounts = supabase_service.get_user_email_accounts(user_id)
#         accounts     = [a for a in all_accounts if a.get('provider') == 'outlook']
#         if account_id:
#             accounts = [a for a in accounts if a['id'] == account_id]

#         total_saved = 0
#         for account in accounts:
#             saved_count, _ = _sync_outlook_account(user_id, account)
#             total_saved += saved_count

#         return jsonify({'success': True, 'synced': total_saved})

#     except Exception as e:
#         print(f'Outlook sync error: {e}', flush=True)
#         return jsonify({'error': str(e)}), 500


# # ── OUTLOOK SEND ──────────────────────────────────────────────────────────
# @app.route('/api/outlook/send', methods=['POST'])
# def send_outlook_email():
#     try:
#         data       = request.json
#         account_id = data.get('account_id')
#         account    = supabase_service.get_email_account(account_id)

#         result = outlook_service.send_email(
#             access_token=account['access_token'],
#             to=data['to'],
#             subject=data['subject'],
#             body=data['body'],
#         )
#         return jsonify(result)

#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# # ── SUMMARISE ─────────────────────────────────────────────────────────────
# @app.route('/api/summarize', methods=['POST'])
# def summarize():
#     data          = request.get_json(silent=True) or {}
#     email_body    = data.get('email_body')
#     email_id      = data.get('email_id') or data.get('sender_id')
#     model_name    = data.get('model_name', 'bitnet')
#     prompt_version = data.get('prompt_version', 'v1')

#     if not email_body or not email_id:
#         return jsonify({'error': 'email_body and email_id are required'}), 400

#     cached_summary = cache_check(email_id, model_name, email_body, prompt_version)
#     if cached_summary:
#         return jsonify({'status': 'cached', 'summary': cached_summary}), 200

#     content_hash = generate_content_hash(email_body)
#     job_key      = generate_job_key(email_id, model_name, prompt_version, content_hash)

#     result = fetch_or_generate_summary(job_key, email_body, email_id, model_name, content_hash, prompt_version)
#     return jsonify(result), 202


# if __name__ == '__main__':
#     port  = int(os.getenv('PORT', 5000))
#     debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
#     print(f" Starting Flask development server on port {port}")
#     print(f" Debug mode: {debug}", flush=True)
#     app.run(host='0.0.0.0', port=port, debug=debug)

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
import time
from datetime import datetime, timedelta
import re

app = Flask(__name__)
allowed_origins_frontend = os.getenv("ALLOWED_ORIGINS", "http://localhost:8080").split(",")
CORS(app, origins=allowed_origins_frontend)

# init GMAIL
gmail_service = GmailService(
    Config.google_client_id,
    Config.google_client_secret,
    Config.redirect_uri,
)

# init IMAP
imap_service = ImapService()

# init SUPABASE (database)
supabase_service = SupabaseService(
    Config.supabase_url,
    Config.supabase_key,
)

# init OUTLOOK
outlook_service = OutlookService(
    Config.microsoft_client_id,
    Config.microsoft_client_secret,
    Config.microsoft_redirect_uri,
    getattr(Config, "microsoft_tenant_id", "common") or "common",
)

OUTLOOK_SUBSCRIPTION_TTL_MINUTES = int(os.getenv("OUTLOOK_SUBSCRIPTION_TTL_MINUTES", "4200"))


def _save_outlook_emails(user_id: str, account: dict, emails: list[dict]) -> list[dict]:
    if not emails:
        return []
    emails_to_save = []
    for email_data in emails:
        email_data["user_id"] = user_id
        email_data["account_id"] = account["id"]
        emails_to_save.append(email_data)
    return supabase_service.save_emails_batch(emails_to_save)


def _sync_outlook_account(user_id: str, account: dict, force_full: bool = False) -> tuple[int, str | None]:
    """
    Sync one Outlook account.

    Strategy:
    - If force_full=True OR no delta link stored → call fetch_emails_full (paginated REST query)
      then persist the fresh delta link returned by that call.
    - Otherwise → call fetch_emails_delta with the stored delta link.
      If the cursor has expired (404/410) fall back to fetch_emails_full.

    Returns (emails_saved, new_delta_link).
    """
    email_address = account.get("email_address", account["id"])
    stored_delta = account.get("last_history_id")  # reused column for Outlook delta link

    access_token = account["access_token"]
    refresh_token = account.get("refresh_token")
    token_expiry = account.get("token_expiry")

    result = None

    # Try delta (incremental) sync first
    if not force_full and stored_delta:
        print(f"{email_address}: trying incremental Outlook sync", flush=True)
        result = outlook_service.fetch_emails_delta(
            access_token=access_token,
            refresh_token=refresh_token,
            token_expiry=token_expiry,
            delta_link=stored_delta,
        )
        if result is None:
            print(f"{email_address}: delta cursor expired, falling back to full sync", flush=True)

    # Full sync (backfill or fallback)
    if result is None:
        print(f"{email_address}: running full Outlook sync", flush=True)
        result = outlook_service.fetch_emails_full(
            access_token=access_token,
            refresh_token=refresh_token,
            token_expiry=token_expiry,
            max_results=100,
        )

    if not result:
        print(f"{email_address}: Outlook sync returned no result", flush=True)
        return 0, None

    emails = result.get("emails", [])
    new_delta = result.get("delta_link")

    saved_rows = _save_outlook_emails(user_id, account, emails)
    saved_count = len(saved_rows) if saved_rows else 0

    print(
        f"{email_address}: Outlook sync saved {saved_count}/{len(emails)} emails, "
        f"delta_link={'yes' if new_delta else 'no'}",
        flush=True,
    )

    # Persist the new delta link so the next sync is incremental
    if new_delta:
        supabase_service.update_account_history_id(
            account["id"],
            new_delta,
            email_address=email_address,
        )

    return saved_count, new_delta


# ── Provider settings ─────────────────────────────────────────────────────
PROVIDER_SETTINGS = {
    "yahoo": {
        "imap_host": "imap.mail.yahoo.com",
        "imap_port": 993,
        "smtp_host": "smtp.mail.yahoo.com",
        "smtp_port": 465,
    },
    "outlook": {
        "imap_host": "outlook.office365.com",
        "imap_port": 993,
        "smtp_host": "smtp.office365.com",
        "smtp_port": 587,
    },
    "imap": {},
}


# ── HEALTH ────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "pigeon-backend"})


@app.route("/api/gmail/renew-watches", methods=["POST"])
def renew_watches():
    """Call this daily to keep push notifications alive."""
    try:
        accounts = (
            supabase_service.client.table("email_accounts")
            .select("*")
            .eq("is_connected", True)
            .execute()
        )

        push_service = GmailPushService(gmail_service)
        renewed = 0

        for account in accounts.data:
            push_service.watch_inbox(
                user_email=account["email_address"],
                access_token=account["access_token"],
                refresh_token=account["refresh_token"],
            )
            renewed += 1

        return jsonify({"success": True, "renewed": renewed})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── GMAIL OAUTH CALLBACK ──────────────────────────────────────────────────
@app.route("/api/gmail/oauth/callback", methods=["POST"])
def gmail_oauth_callback():
    try:
        data = request.json
        code = data["code"]
        user_id = data["user_id"]

        tokens = gmail_service.exchange_code_for_tokens(code)

        existing = (
            supabase_service.client.table("email_accounts")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )
        is_first = len(existing.data) == 0

        existing_account = (
            supabase_service.client.table("email_accounts")
            .select("id,last_history_id")
            .eq("user_id", user_id)
            .eq("email_address", tokens["gmail_email"])
            .limit(1)
            .execute()
        )

        existing_account_row = existing_account.data[0] if existing_account.data else None
        had_history = bool(existing_account_row and existing_account_row.get("last_history_id"))

        # IMPORTANT: for a brand‑new account, seed last_history_id from Google's profile history_id
        if had_history:
            last_history_id = str(existing_account_row["last_history_id"])
        else:
            last_history_id = str(tokens.get("history_id")) if tokens.get("history_id") else None

        account_data = {
            "user_id": user_id,
            "email_address": tokens["gmail_email"],
            "provider": "gmail",
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "token_expiry": tokens["token_expiry"],
            "is_primary": is_first,
            "is_connected": True,
            "backfill_complete": False,
            "last_history_id": last_history_id,
        }

        result = (
            supabase_service.client.table("email_accounts")
            .upsert(account_data, on_conflict="user_id,email_address")
            .execute()
        )

        push_service = GmailPushService(gmail_service)
        push_service.watch_inbox(
            user_email=tokens["gmail_email"],
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
        )

        # If this account never had a history_id before, run full backfill in background
        if not had_history:
            thread_account = result.data[0]
            threading.Thread(
                target=run_initial_gmail_backfill,
                args=(user_id, thread_account),
                daemon=True,
            ).start()

        return jsonify(
            {
                "success": True,
                "gmail_email": tokens["gmail_email"],
                "account_id": result.data[0]["id"],
            }
        )

    except Exception as e:
        print(f"OAuth error: {e}", flush=True)
        return jsonify({"success": False, "error": str(e)}), 400


# ── GMAIL BACKFILL ────────────────────────────────────────────────────────
def run_initial_gmail_backfill(user_id: str, account: dict):
    """
    Background backfill of the *entire* Gmail inbox for a newly connected account.

    This walks messages.list pages from newest to oldest and streams chunks of
    message IDs into fetch_details_parallel, so you do not build a huge in‑memory
    list and you do not artificially limit to the last 30 days.
    """
    account_id = account.get("id")
    backfill_succeeded = False
    try:
        email_address = account["email_address"]
        access_token = account["access_token"]
        refresh_token = account["refresh_token"]

        print(f"{email_address}: starting full Gmail backfill...", flush=True)

        service = gmail_service.get_gmail_service(access_token, refresh_token)

        CHUNK_SIZE = 25
        MAX_WORKERS = 2
        SLEEP_SECS = 2

        total_saved = 0
        page_token: str | None = None

        while True:
            kwargs = {
                "userId": "me",
                "q": "in:inbox",
                "maxResults": 500,
            }
            if page_token:
                kwargs["pageToken"] = page_token

            results = service.users().messages().list(**kwargs).execute()
            messages = results.get("messages", []) or []
            if not messages:
                break

            message_ids = [msg["id"] for msg in messages]

            for i in range(0, len(message_ids), CHUNK_SIZE):
                chunk_ids = message_ids[i : i + CHUNK_SIZE]

                emails = gmail_service.fetch_details_parallel(
                    access_token,
                    refresh_token,
                    chunk_ids,
                    max_workers=MAX_WORKERS,
                )

                for email_data in emails:
                    email_data["user_id"] = user_id
                    email_data["account_id"] = account_id

                if emails:
                    saved = supabase_service.save_emails_batch(emails)
                    total_saved += len(saved) if saved else 0

                print(
                    f"{email_address}: backfill batch — {total_saved} emails saved so far",
                    flush=True,
                )

                del emails
                gc.collect()
                time.sleep(SLEEP_SECS)

            page_token = results.get("nextPageToken")
            if not page_token:
                break

        profile = service.users().getProfile(userId="me").execute()
        history_id = profile.get("historyId")

        if history_id:
            supabase_service.update_account_history_id(
                account_id,
                history_id,
                email_address=email_address,
            )

        print(f"{email_address}: backfill complete — {total_saved} emails saved", flush=True)
        backfill_succeeded = True

    except Exception as e:
        print(f"Backfill error for {account.get('email_address', 'unknown')}: {e}", flush=True)
    finally:
        if account_id:
            try:
                supabase_service.client.table("email_accounts")\
                    .update({"backfill_complete": backfill_succeeded})\
                    .eq("id", account_id)\
                    .execute()
            except Exception as e:
                print(f"Failed to mark Gmail backfill complete: {e}", flush=True)


# ── GMAIL SYNC ────────────────────────────────────────────────────────────
@app.route("/api/gmail/sync", methods=["POST"])
def sync_gmail():
    try:
        data = request.json
        user_id = data["user_id"]
        account_id = data.get("account_id")

        accounts = (
            [supabase_service.get_email_account(account_id)]
            if account_id
            else supabase_service.get_user_email_accounts(user_id)
        )

        total_saved = 0

        for account in accounts:
            email_address = account.get("email_address", account["id"])
            history_id = account.get("last_history_id")

            if history_id:
                result = gmail_service.fetch_emails_incremental(
                    access_token=account["access_token"],
                    refresh_token=account["refresh_token"],
                    start_history_id=history_id,
                )
                if result is None:
                    print(f"{email_address}: history expired, falling back to full sync", flush=True)
                    result = gmail_service.fetch_emails_full(
                        access_token=account["access_token"],
                        refresh_token=account["refresh_token"],
                        max_results=50,
                    )
            else:
                print(f"{email_address}: no history ID — full fetch", flush=True)
                result = gmail_service.fetch_emails_full(
                    access_token=account["access_token"],
                    refresh_token=account["refresh_token"],
                    max_results=100,
                )

            emails_to_save = []
            for email_data in result["emails"]:
                email_data["user_id"] = user_id
                email_data["account_id"] = account["id"]
                emails_to_save.append(email_data)

            if emails_to_save:
                saved = supabase_service.save_emails_batch(emails_to_save)
                total_saved += len(saved) if saved else 0

            if result.get("history_id"):
                supabase_service.update_account_history_id(
                    account["id"],
                    result["history_id"],
                    email_address=email_address,
                )

            sync_type = "full" if result.get("is_full_sync") else "incremental"
            print(
                f"{email_address}: {sync_type} sync — "
                f"{len(emails_to_save)} emails, historyId={result.get('history_id')}",
                flush=True,
            )

        return jsonify(
            {
                "success": True,
                "synced": total_saved,
                "accounts_synced": len(accounts),
            }
        )

    except Exception as e:
        print(f"Sync error: {e}", flush=True)
        return jsonify({"error": str(e)}), 500


# ── IMAP CONNECT ──────────────────────────────────────────────────────────
@app.route("/api/imap/connect", methods=["POST"])
def connect_imap():
    try:
        data = request.json
        user_id = data["user_id"]
        provider = data["provider"]
        email = data["email"]
        password = data["password"]

        if provider in PROVIDER_SETTINGS and PROVIDER_SETTINGS[provider]:
            settings = PROVIDER_SETTINGS[provider]
        else:
            settings = {
                "imap_host": data["imap_host"],
                "imap_port": int(data.get("imap_port", 993)),
                "smtp_host": data["smtp_host"],
                "smtp_port": int(data.get("smtp_port", 465)),
            }

        imap_host = settings["imap_host"]
        imap_port = settings["imap_port"]
        smtp_host = settings["smtp_host"]
        smtp_port = settings["smtp_port"]

        ok, err_msg = imap_service.test_connection(imap_host, imap_port, email, password)
        if not ok:
            return jsonify({"success": False, "error": err_msg}), 400

        existing = supabase_service.client.table("email_accounts").select("id").eq("user_id", user_id).execute()
        is_first = len(existing.data) == 0

        account_data = {
            "user_id": user_id,
            "email_address": email,
            "provider": provider,
            "password_encrypted": password,
            "imap_host": imap_host,
            "imap_port": imap_port,
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "is_primary": is_first,
            "is_connected": True,
        }

        result = (
            supabase_service.client.table("email_accounts")
            .upsert(account_data, on_conflict="user_id,email_address")
            .execute()
        )

        account_id = result.data[0]["id"]
        print(f"IMAP account saved: {email} ({provider}), id={account_id}", flush=True)

        return jsonify({"success": True, "account_id": account_id, "email": email})

    except Exception as e:
        print(f"IMAP connect error: {e}", flush=True)
        return jsonify({"success": False, "error": str(e)}), 500


# ── IMAP SYNC ─────────────────────────────────────────────────────────────
@app.route("/api/imap/sync", methods=["POST"])
def sync_imap():
    try:
        data = request.json
        user_id = data["user_id"]
        account_id = data.get("account_id")

        if account_id:
            accounts = [supabase_service.get_email_account(account_id)]
        else:
            all_accounts = supabase_service.get_user_email_accounts(user_id)
            accounts = [a for a in all_accounts if a.get("provider") in {"yahoo", "imap"}]

        if not accounts:
            return jsonify({"success": True, "synced": 0, "accounts_synced": 0})

        total_saved = 0

        for account in accounts:
            email_address = account["email_address"]

            result = imap_service.fetch_emails(
                host=account["imap_host"],
                port=account["imap_port"],
                username=email_address,
                password=account.get("password_encrypted") or account.get("password"),
                max_results=50,
            )

            emails_to_save = []
            for email_data in result["emails"]:
                email_data["user_id"] = user_id
                email_data["account_id"] = account["id"]
                emails_to_save.append(email_data)

            if emails_to_save:
                saved = supabase_service.save_emails_batch(emails_to_save)
                total_saved += len(saved) if saved else 0

            supabase_service.client.table("email_accounts")\
                .update({"last_sync": supabase_service._now_iso()})\
                .eq("id", account["id"]).execute()

            print(f"IMAP sync: {email_address} — {len(emails_to_save)} emails", flush=True)

        return jsonify({"success": True, "synced": total_saved, "accounts_synced": len(accounts)})

    except Exception as e:
        print(f"IMAP sync error: {e}", flush=True)
        return jsonify({"error": str(e)}), 500


# ── GET EMAILS ────────────────────────────────────────────────────────────
@app.route("/api/emails", methods=["GET"])
def get_emails():
    try:
        user_id = request.args.get("user_id")
        account_id = request.args.get("account_id")
        limit = int(request.args.get("limit", 100))

        emails = (
            supabase_service.get_emails_by_account(account_id, limit)
            if account_id
            else supabase_service.get_emails(user_id, limit)
        )
        return jsonify({"success": True, "emails": emails})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── SEND EMAIL (Gmail) ────────────────────────────────────────────────────
@app.route("/api/gmail/send", methods=["POST"])
def send_email():
    try:
        data = request.json
        user_id = data["user_id"]
        tokens = supabase_service.get_gmail_tokens(user_id)
        result = gmail_service.send_email(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            to=data["to"],
            subject=data["subject"],
            body=data["body"],
        )
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── GMAIL WEBHOOK ─────────────────────────────────────────────────────────
@app.route("/api/gmail/webhook", methods=["POST"])
def gmail_webhook():
    try:
        notification = request.json
        message = json.loads(base64.b64decode(notification["message"]["data"]).decode())
        email_address = message["emailAddress"]
        history_id = message["historyId"]

        accounts = (
            supabase_service.client.table("email_accounts")
            .select("*")
            .eq("email_address", email_address)
            .execute()
        )

        if not accounts.data:
            return "OK", 200

        account = accounts.data[0]

        if not account.get("last_history_id"):
            supabase_service.update_account_history_id(
                account["id"], history_id, account["email_address"]
            )
            return "OK", 200

        result = gmail_service.fetch_emails_incremental(
            access_token=account["access_token"],
            refresh_token=account["refresh_token"],
            start_history_id=account["last_history_id"],
        )

        if result and result.get("emails"):
            for email_data in result["emails"]:
                email_data["user_id"] = account["user_id"]
                email_data["account_id"] = account["id"]

            saved_emails = supabase_service.save_emails_batch(result["emails"])
            saved_email_by_gmail_id = {
                row.get("gmail_id"): row for row in saved_emails if row.get("gmail_id")
            }

            for email_data in result["emails"]:
                raw_email_body = email_data.get("body_text") or ""
                if not raw_email_body:
                    continue

                saved_email = saved_email_by_gmail_id.get(email_data.get("gmail_id"))
                if not saved_email:
                    continue

                email_body = trim_email_body(raw_email_body)
                sender_email = account["email_address"]
                model_name = "bitnet"
                prompt_version = "v1"
                content_hash = generate_content_hash(email_body)
                job_key = generate_job_key(
                    sender_email, model_name, prompt_version, content_hash
                )

                fetch_or_generate_summary(
                    job_key,
                    email_body,
                    saved_email["id"],
                    model_name,
                    content_hash,
                    prompt_version,
                    user_id=account["user_id"],
                )

            supabase_service.update_account_history_id(
                account["id"], history_id, email_address
            )

        return "OK", 200

    except Exception as e:
        print(f"Webhook error: {e}", flush=True)
        return "ERROR", 500


# ── OUTLOOK WEBHOOK ───────────────────────────────────────────────────────
@app.route("/api/outlook/webhook", methods=["GET", "POST"])
def outlook_webhook():
    try:
        validation_token = request.args.get("validationToken")
        if validation_token:
            return validation_token, 200, {"Content-Type": "text/plain; charset=utf-8"}

        payload = request.json or {}
        notifications = payload.get("value", []) if isinstance(payload, dict) else []

        for notification in notifications:
            account_id = notification.get("clientState")
            if not account_id:
                continue

            account = supabase_service.get_email_account(account_id)
            if not account:
                continue

            threading.Thread(
                target=_sync_outlook_account,
                args=(account["user_id"], account),
                daemon=True,
            ).start()

        return "OK", 202

    except Exception as e:
        print(f"Outlook webhook error: {e}", flush=True)
        return "ERROR", 500


# ── OUTLOOK OAUTH CALLBACK ────────────────────────────────────────────────
@app.route("/api/outlook/oauth/callback", methods=["POST"])
def outlook_oauth_callback():
    try:
        data = request.json
        code = data["code"]
        user_id = data["user_id"]

        tokens = outlook_service.exchange_code_for_tokens(code)

        existing = (
            supabase_service.client.table("email_accounts")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )
        is_first = len(existing.data) == 0

        account_data = {
            "user_id": user_id,
            "email_address": tokens["email"],
            "provider": "outlook",
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "token_expiry": tokens["token_expiry"],
            "is_primary": is_first,
            "is_connected": True,
            "backfill_complete": False,
            # Clear any stale delta link so backfill does a full sync
            "last_history_id": None,
        }

        result = (
            supabase_service.client.table("email_accounts")
            .upsert(account_data, on_conflict="user_id,email_address")
            .execute()
        )

        account_row = result.data[0]
        account_id = account_row["id"]

        # Backfill in background
        threading.Thread(
            target=_run_outlook_backfill,
            args=(user_id, account_row),
            daemon=True,
        ).start()

        # Webhook subscription is best-effort
        try:
            raw_root = request.url_root.rstrip("/")
            webhook_url = raw_root.replace("http://", "https://") + "/api/outlook/webhook"
            outlook_service.create_inbox_subscription(
                access_token=tokens["access_token"],
                notification_url=webhook_url,
                client_state=account_id,
                ttl_minutes=OUTLOOK_SUBSCRIPTION_TTL_MINUTES,
            )
            print(f"Outlook subscription created for {tokens['email']}", flush=True)
        except Exception as sub_err:
            print(f"Outlook subscription skipped (not critical): {sub_err}", flush=True)

        return jsonify({"success": True, "email": tokens["email"], "account_id": account_id})

    except Exception as e:
        print(f"Outlook OAuth error: {e}", flush=True)
        return jsonify({"success": False, "error": str(e)}), 400


def _run_outlook_backfill(user_id: str, account: dict):
    """Full sync for a newly connected Outlook account."""
    backfill_succeeded = False
    try:
        saved_count, _ = _sync_outlook_account(user_id, account, force_full=True)
        print(
            f"Outlook backfill complete for {account['email_address']}: {saved_count} emails saved",
            flush=True,
        )
        backfill_succeeded = True
    except Exception as e:
        print(
            f"Outlook backfill error for {account.get('email_address', 'unknown')}: {e}",
            flush=True,
        )
    finally:
        try:
            supabase_service.client.table("email_accounts")\
                .update({"backfill_complete": backfill_succeeded})\
                .eq("id", account["id"])\
                .execute()
        except Exception as e:
            print(f"Failed to mark Outlook backfill complete: {e}", flush=True)


# ── OUTLOOK SYNC ──────────────────────────────────────────────────────────
@app.route("/api/outlook/sync", methods=["POST"])
def sync_outlook():
    try:
        data = request.json
        user_id = data["user_id"]
        account_id = data.get("account_id")

        all_accounts = supabase_service.get_user_email_accounts(user_id)
        accounts = [a for a in all_accounts if a.get("provider") == "outlook"]
        if account_id:
            accounts = [a for a in accounts if a["id"] == account_id]

        total_saved = 0
        for account in accounts:
            saved_count, _ = _sync_outlook_account(user_id, account)
            total_saved += saved_count

        return jsonify({"success": True, "synced": total_saved})

    except Exception as e:
        print(f"Outlook sync error: {e}", flush=True)
        return jsonify({"error": str(e)}), 500


# ── OUTLOOK SEND ──────────────────────────────────────────────────────────
@app.route("/api/outlook/send", methods=["POST"])
def send_outlook_email():
    try:
        data = request.json
        account_id = data.get("account_id")
        account = supabase_service.get_email_account(account_id)

        result = outlook_service.send_email(
            access_token=account["access_token"],
            to=data["to"],
            subject=data["subject"],
            body=data["body"],
        )
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── SUMMARISE ─────────────────────────────────────────────────────────────
@app.route("/api/summarize", methods=["POST"])
def summarize():
    data = request.get_json(silent=True) or {}
    email_body = data.get("email_body")
    email_id = data.get("email_id") or data.get("sender_id")
    model_name = data.get("model_name", "bitnet")
    prompt_version = data.get("prompt_version", "v1")

    if not email_body or not email_id:
        return jsonify({"error": "email_body and email_id are required"}), 400

    cached_summary = cache_check(email_id, model_name, email_body, prompt_version)
    if cached_summary:
        return jsonify({"status": "cached", "summary": cached_summary}), 200

    content_hash = generate_content_hash(email_body)
    job_key = generate_job_key(email_id, model_name, prompt_version, content_hash)

    result = fetch_or_generate_summary(
        job_key, email_body, email_id, model_name, content_hash, prompt_version
    )
    return jsonify(result), 202


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    print(f" Starting Flask development server on port {port}")
    print(f" Debug mode: {debug}", flush=True)
    app.run(host="0.0.0.0", port=port, debug=debug)