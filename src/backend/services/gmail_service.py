from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re
from email.utils import parsedate_to_datetime
from html2text import html2text
#multithreading 
from concurrent.futures import ThreadPoolExecutor, as_completed


class GmailService:
    def __init__(self, client_id, client_secret, redirect_uri):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri

    # ── AUTH ──────────────────────────────────────────────────────────────

    def exchange_code_for_tokens(self, auth_code):
        """Exchange authorization code for access + refresh tokens"""
        print(f"~Backend redirect_uri: {self.redirect_uri}", flush=True)
        print(f"~Backend client_id: {self.client_id}", flush=True)
        print(f"~Auth code received: {auth_code[:20]}...", flush=True)

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uris": [self.redirect_uri],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=[
                'openid',
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify',
                'https://www.googleapis.com/auth/gmail.compose',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.labels',
                'https://www.googleapis.com/auth/userinfo.email',
            ]
        )
        flow.redirect_uri = self.redirect_uri
        print(f"~Flow redirect_uri: {flow.redirect_uri}", flush=True)

        try:
            flow.fetch_token(code=auth_code)
            credentials = flow.credentials
            service = build('gmail', 'v1', credentials=credentials)
            profile = service.users().getProfile(userId='me').execute()

            return {
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_expiry': credentials.expiry.isoformat() if credentials.expiry else None,
                'gmail_email': profile['emailAddress'],
                'history_id': profile.get('historyId'),   # <-- capture on first connect
            }
        except Exception as e:
            print(f"!!! Token exchange error: {e}", flush=True)
            raise

    def get_gmail_service(self, access_token, refresh_token):
        """Build an authenticated Gmail API client"""
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=self.client_id,
            client_secret=self.client_secret
        )
        return build('gmail', 'v1', credentials=credentials)

    # ── SYNC ──────────────────────────────────────────────────────────────

    def fetch_emails_full(self, access_token, refresh_token, max_results=50, page_token=None):
        """
        Full sync: fetch the most recent N emails.
        Used on the very first sync (no history_id yet).
        Supports pagination via page_token.
        Returns { emails, history_id, next_page_token }
        """
        try:
            service = self.get_gmail_service(access_token, refresh_token)

            kwargs = {
                'userId': 'me',
                'q': 'in:inbox'
            }
            if max_results:
                kwargs['maxResults'] = max_results
            if page_token:
                kwargs['pageToken'] = page_token

            results = service.users().messages().list(**kwargs).execute()

            messages = results.get('messages', [])

            # emails = []
            # for msg in messages:
            #     email_data = self._get_email_details(service, msg['id'])
            #     if email_data:
            #         emails.append(email_data)

            # optimised block
            message_ids = [msg['id'] for msg in messages]
            emails = self.fetch_details_parallel(service, message_ids) #using the optmisation function 

            # Grab current historyId so next sync can be incremental
            profile = service.users().getProfile(userId='me').execute()
            history_id = profile.get('historyId')
            next_page_token = results.get('nextPageToken')

            print(f"Full sync: fetched {len(emails)} emails, historyId={history_id}")
            return {
                'emails': emails,
                'history_id': history_id,
                'next_page_token': next_page_token,
                'is_full_sync': True
            }

        except HttpError as error:
            print(f'Gmail API error during full sync: {error}', flush=True)
            return {
                'emails': [],
                'history_id': None,
                'next_page_token': None,
                'is_full_sync': True
            }

    def fetch_emails_incremental(self, access_token, refresh_token, start_history_id):
        """
        Incremental sync: only fetch messages added since start_history_id.
        This is very fast — only new emails are returned.
        Returns { emails, history_id } or None if history expired (caller should fall back to full sync).
        """
        try:
            service = self.get_gmail_service(access_token, refresh_token)

            # Walk through all history pages
            new_message_ids = set()
            page_token = None

            while True:
                kwargs = {
                    'userId': 'me',
                    'startHistoryId': start_history_id,
                    'historyTypes': ['messageAdded'],
                }
                if page_token:
                    kwargs['pageToken'] = page_token

                history_response = service.users().history().list(**kwargs).execute()

                for record in history_response.get('history', []):
                    for added in record.get('messagesAdded', []):
                        msg = added.get('message', {})
                        # Only inbox messages (skip sent, spam, etc.)
                        labels = msg.get('labelIds', [])
                        if 'INBOX' in labels:
                            new_message_ids.add(msg['id'])

                page_token = history_response.get('nextPageToken')
                if not page_token:
                    break

            new_history_id = history_response.get('historyId', start_history_id)

            # Fetch full details for each new message
            # emails = []
            # for msg_id in new_message_ids:
            #     email_data = self._get_email_details(service, msg_id)
            #     if email_data:
            #         emails.append(email_data)

            # optimised block
            emails = self.fetch_details_parallel(service, list(new_message_ids))

            print(f"Incremental sync: {len(emails)} new emails since historyId={start_history_id}, new historyId={new_history_id}", flush=True)
            return {'emails': emails, 'history_id': new_history_id, 'is_full_sync': False}

        except HttpError as error:
            # 404 means the historyId is too old — Gmail only keeps ~30 days of history
            if error.resp.status == 404:
                print(f"History ID expired (404), falling back to full sync", flush=True)
                return None  # Signal to caller to do a full sync
            print(f'Gmail API error during incremental sync: {error}', flush=True)
            return {'emails': [], 'history_id': start_history_id, 'is_full_sync': False}

    # ── EMAIL PARSING ─────────────────────────────────────────────────────

    def _get_email_details(self, service, msg_id):
        """Fetch and parse a single email"""
        try:
            message = service.users().messages().get(
                userId='me',
                id=msg_id,
                format='full'
            ).execute()

            headers = message['payload']['headers']

            def get_header(name):
                for h in headers:
                    if h['name'].lower() == name.lower():
                        return h['value']
                return None

            body = self._get_email_body(message['payload'])

            return {
                'gmail_id': message['id'],
                'thread_id': message['threadId'],
                'subject': get_header('Subject') or '(No Subject)',
                'from_email': self._extract_email(get_header('From')),
                'from_name': self._extract_name(get_header('From')),
                'to_email': self._parse_email_list(get_header('To')),
                'cc_email': self._parse_email_list(get_header('Cc')),
                'received_at': self._parse_date(get_header('Date')),
                'body_text': body['text'],
                'body_html': body['html'],
                'snippet': message.get('snippet', ''),
                'labels': message.get('labelIds', []),
                'is_read': 'UNREAD' not in message.get('labelIds', []),
                'is_starred': 'STARRED' in message.get('labelIds', []),
            }
        except Exception as e:
            print(f'Error fetching email {msg_id}: {e}', flush=True)
            return None

    def _get_email_body(self, payload):
        """Recursively extract text and HTML body from MIME parts"""
        body = {'text': '', 'html': ''}

        if 'parts' in payload:
            for part in payload['parts']:
                if part['mimeType'] == 'text/plain' and 'data' in part['body']:
                    body['text'] = base64.urlsafe_b64decode(
                        part['body']['data']
                    ).decode('utf-8', errors='ignore')
                elif part['mimeType'] == 'text/html' and 'data' in part['body']:
                    body['html'] = base64.urlsafe_b64decode(
                        part['body']['data']
                    ).decode('utf-8', errors='ignore')
                elif 'parts' in part:
                    nested = self._get_email_body(part)
                    body['text'] = body['text'] or nested['text']
                    body['html'] = body['html'] or nested['html']
        elif 'body' in payload and 'data' in payload['body']:
            decoded = base64.urlsafe_b64decode(
                payload['body']['data']
            ).decode('utf-8', errors='ignore')
            if payload['mimeType'] == 'text/plain':
                body['text'] = decoded
            elif payload['mimeType'] == 'text/html':
                body['html'] = decoded

        # Fallback: convert HTML → plain text
        if not body['text'] and body['html']:
            body['text'] = html2text(body['html'])

        return body

    # ── HELPERS ───────────────────────────────────────────────────────────

    def _extract_email(self, from_header):
        if not from_header:
            return ''
        match = re.search(r'<(.+?)>', from_header)
        return match.group(1) if match else from_header.strip()

    def _extract_name(self, from_header):
        if not from_header:
            return ''
        match = re.match(r'^(.+?)\s*<.+?>$', from_header)
        return match.group(1).strip('"') if match else self._extract_email(from_header)

    def _parse_email_list(self, email_str):
        if not email_str:
            return []
        return re.findall(r'[\w\.-]+@[\w\.-]+', email_str)

    def _parse_date(self, date_str):
        try:
            return parsedate_to_datetime(date_str).isoformat()
        except Exception:
            return None

    # ── SEND ──────────────────────────────────────────────────────────────

    def send_email(self, access_token, refresh_token, to, subject, body):
        service = self.get_gmail_service(access_token, refresh_token)
        message = MIMEText(body)
        message['to'] = to
        message['subject'] = subject
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        try:
            sent = service.users().messages().send(
                userId='me',
                body={'raw': raw_message}
            ).execute()
            return {'success': True, 'message_id': sent['id']}
        except HttpError as error:
            return {'success': False, 'error': str(error)}


    # optimisation and multithreading
    def fetch_details_parallel(self, service, message_ids, max_workers=10):
        emails = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(self._get_email_details, service, mid): mid for mid in message_ids}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    emails.append(result)
        return emails