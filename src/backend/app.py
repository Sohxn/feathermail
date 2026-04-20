from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from services.gmail_service import GmailService
from services.supa_auth import SupabaseService
import os
import logging 
from services.gmail_push import GmailPushService
import json 
import base64

#testing
app = Flask(__name__)
allowed_origins_frontend = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8080').split(',')
CORS(app, origins=allowed_origins_frontend)

#init
gmail_service = GmailService(
    Config.google_client_id,
    Config.google_client_secret,
    Config.redirect_uri
)

print("URL:", os.getenv("SUPABASE_URL"))
print("KEY:", os.getenv("SUPABASE_SERVICE_KEY"))

supabase_service = SupabaseService(
    Config.supabase_url,
    Config.supabase_key
)



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

        account_data = {
            'user_id': user_id,
            'email_address': tokens['gmail_email'],
            'provider': 'gmail',
            'access_token': tokens['access_token'],
            'refresh_token': tokens['refresh_token'],
            'token_expiry': tokens['token_expiry'],
            'is_primary': is_first,
            'is_connected': True,
            'last_history_id': str(tokens['history_id']) if tokens.get('history_id') else None,
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

        return jsonify({
            'success': True,
            'gmail_email': tokens['gmail_email'],
            'account_id': result.data[0]['id']
        })

    except Exception as e:
        print(f'OAuth error: {e}', flush=True)
        return jsonify({'success': False, 'error': str(e)}), 400


# ── SYNC ──────────────────────────────────────────────────────────────────

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
        
        # Get user from database
        account = supabase_service.client.table('email_accounts')\
            .select('*')\
            .eq('email_address', email_address)\
            .single()\
            .execute()
        
        if not account.data:
            return 'OK', 200  # Unknown user, ignore
        
        # Fetch only NEW emails using incremental sync
        result = gmail_service.fetch_emails_incremental(
            access_token=account.data['access_token'],
            refresh_token=account.data['refresh_token'],
            start_history_id=account.data['last_history_id']
        )
        
        # Save new emails to database
        if result['emails']:
            for email_data in result['emails']:
                email_data['user_id'] = account.data['user_id']
                email_data['account_id'] = account.data['id']
            
            supabase_service.save_emails_batch(result['emails'])
            
            # Update history ID
            supabase_service.update_account_history_id(
                account.data['id'],
                history_id,
                email_address
            )
        
        return 'OK', 200
    
    except Exception as e:
        print(f'Webhook error: {e}', flush=True)
        return 'ERROR', 500


if __name__ == '__main__':
    import os
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    print(f" Starting Flask development server on port {port}")
    print(f" Debug mode: {debug}", flush=True)
    
    app.run(host='0.0.0.0',port=port,debug=debug)