import requests
from datetime import datetime, timezone


GRAPH_BASE = 'https://graph.microsoft.com/v1.0'


def token_url_for_tenant(tenant: str) -> str:
    return f'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token'


class OutlookService:
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, tenant: str = 'common'):
        self.client_id     = client_id
        self.client_secret = client_secret
        self.redirect_uri  = redirect_uri
        self.tenant        = tenant or 'common'
        self.token_url     = token_url_for_tenant(self.tenant)

    # ── AUTH ──────────────────────────────────────────────────────────────

    def exchange_code_for_tokens(self, auth_code: str) -> dict:
        resp = requests.post(self.token_url, data={
            'client_id':     self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri':  self.redirect_uri,
            'grant_type':    'authorization_code',
            'code':          auth_code,
            'scope':         'openid profile email offline_access Mail.Read Mail.ReadWrite Mail.Send User.Read',
        })
        resp.raise_for_status()
        data = resp.json()

        # Get user's email address
        profile = self._graph_get('/me', data['access_token'])

        expiry = None
        if 'expires_in' in data:
            from datetime import timedelta
            expiry = (datetime.now(timezone.utc) + timedelta(seconds=data['expires_in'])).isoformat()

        return {
            'access_token':  data['access_token'],
            'refresh_token': data.get('refresh_token'),
            'token_expiry':  expiry,
            'email':         profile.get('mail') or profile.get('userPrincipalName'),
        }

    def refresh_access_token(self, refresh_token: str) -> dict:
        resp = requests.post(self.token_url, data={
            'client_id':     self.client_id,
            'client_secret': self.client_secret,
            'refresh_token': refresh_token,
            'grant_type':    'refresh_token',
            'scope':         'openid profile email offline_access Mail.Read Mail.ReadWrite Mail.Send User.Read',
        })
        resp.raise_for_status()
        data = resp.json()

        expiry = None
        if 'expires_in' in data:
            from datetime import timedelta
            expiry = (datetime.now(timezone.utc) + timedelta(seconds=data['expires_in'])).isoformat()

        return {
            'access_token': data['access_token'],
            'refresh_token': data.get('refresh_token', refresh_token),
            'token_expiry':  expiry,
        }

    # ── GRAPH HELPERS ─────────────────────────────────────────────────────

    def _graph_get(self, path: str, access_token: str) -> dict:
        resp = requests.get(
            f'{GRAPH_BASE}{path}',
            headers={'Authorization': f'Bearer {access_token}'},
        )
        resp.raise_for_status()
        return resp.json()

    def _get_fresh_token(self, account: dict) -> str:
        """Return a valid access token, refreshing if needed."""
        expiry = account.get('token_expiry')
        if expiry:
            exp_dt = datetime.fromisoformat(expiry)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            remaining = (exp_dt - datetime.now(timezone.utc)).total_seconds()
            if remaining < 300:  # refresh if less than 5 minutes left
                tokens = self.refresh_access_token(account['refresh_token'])
                return tokens['access_token']
        return account['access_token']

    # ── FETCH EMAILS ─────────────────────────────────────────────────────

    def fetch_emails_full(self, access_token: str, refresh_token: str,
                          max_results: int = 50) -> dict:
        """Fetch most recent N emails from inbox."""
        params = {
            '$top':     max_results,
            '$orderby': 'receivedDateTime desc',
            '$select':  'id,subject,from,toRecipients,ccRecipients,receivedDateTime,'
                        'body,bodyPreview,isRead,flag,parentFolderId',
        }
        resp = requests.get(
            f'{GRAPH_BASE}/me/mailFolders/inbox/messages',
            headers={'Authorization': f'Bearer {access_token}'},
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        emails = [self._parse_message(m) for m in data.get('value', [])]
        return {'emails': emails, 'is_full_sync': True}

    def fetch_emails_delta(self, access_token: str, delta_link: str | None,
                           max_results: int = 50) -> dict:
        """Fetch messages changed since the last delta link."""
        if delta_link:
            resp = requests.get(
                delta_link,
                headers={'Authorization': f'Bearer {access_token}'},
            )
        else:
            resp = requests.get(
                f'{GRAPH_BASE}/me/mailFolders/inbox/messages/delta',
                headers={'Authorization': f'Bearer {access_token}'},
                params={
                    '$top':    max_results,
                    '$select': 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,'
                               'body,bodyPreview,isRead,flag,parentFolderId',
                },
            )
        resp.raise_for_status()
        data = resp.json()

        emails = [self._parse_message(m) for m in data.get('value', [])
                  if not m.get('@removed')]

        next_delta = data.get('@odata.deltaLink') or data.get('@odata.nextLink')

        return {
            'emails':     emails,
            'delta_link': next_delta,
            'is_full_sync': delta_link is None,
        }

    def send_email(self, access_token: str, to: str, subject: str, body: str) -> dict:
        payload = {
            'message': {
                'subject': subject,
                'body':    {'contentType': 'Text', 'content': body},
                'toRecipients': [{'emailAddress': {'address': to}}],
            },
            'saveToSentItems': True,
        }
        resp = requests.post(
            f'{GRAPH_BASE}/me/sendMail',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type':  'application/json',
            },
            json=payload,
        )
        resp.raise_for_status()
        return {'success': True}

    # ── PARSE ─────────────────────────────────────────────────────────────

    def _parse_message(self, msg: dict) -> dict:
        from_addr = msg.get('from', {}).get('emailAddress', {})
        to_list   = [r['emailAddress']['address']
                     for r in msg.get('toRecipients', [])
                     if r.get('emailAddress', {}).get('address')]
        cc_list   = [r['emailAddress']['address']
                     for r in msg.get('ccRecipients', [])
                     if r.get('emailAddress', {}).get('address')]

        body_obj  = msg.get('body', {})
        body_html = body_obj.get('content', '') if body_obj.get('contentType') == 'html' else ''
        body_text = body_obj.get('content', '') if body_obj.get('contentType') == 'text' else ''

        if not body_text and body_html:
            import re
            body_text = re.sub(r'<[^>]+>', ' ', body_html)
            body_text = re.sub(r'\s+', ' ', body_text).strip()

        is_starred = msg.get('flag', {}).get('flagStatus') == 'flagged'

        return {
            'gmail_id':    msg['id'],
            'thread_id':   msg.get('conversationId', msg['id']),
            'subject':     msg.get('subject') or '(No Subject)',
            'from_email':  from_addr.get('address', ''),
            'from_name':   from_addr.get('name') or None,
            'to_email':    to_list,
            'cc_email':    cc_list,
            'received_at': msg.get('receivedDateTime'),
            'body_text':   body_text,
            'body_html':   body_html,
            'snippet':     msg.get('bodyPreview', '')[:200],
            'labels':      ['INBOX'],
            'is_read':     msg.get('isRead', False),
            'is_starred':  is_starred,
        }
