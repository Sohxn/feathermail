import requests
from datetime import datetime, timedelta, timezone


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

    def _refresh_if_needed(self, access_token: str, refresh_token: str | None, token_expiry: str | None = None) -> str:
        if not refresh_token or not token_expiry:
            return access_token

        try:
            expiry = datetime.fromisoformat(token_expiry.replace('Z', '+00:00'))
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)

            if (expiry - datetime.now(timezone.utc)).total_seconds() < 300:
                refreshed = self.refresh_access_token(refresh_token)
                return refreshed['access_token']
        except Exception:
            refreshed = self.refresh_access_token(refresh_token)
            return refreshed['access_token']

        return access_token

    def _request_graph(self, method: str, url: str, access_token: str, refresh_token: str | None = None,
                       token_expiry: str | None = None, **kwargs):
        token = self._refresh_if_needed(access_token, refresh_token, token_expiry)
        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f'Bearer {token}'

        resp = requests.request(method, url, headers=headers, **kwargs)
        if resp.status_code == 401 and refresh_token:
            token = self.refresh_access_token(refresh_token)['access_token']
            headers['Authorization'] = f'Bearer {token}'
            resp = requests.request(method, url, headers=headers, **kwargs)

        resp.raise_for_status()
        return resp

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
                          max_results: int = 50, token_expiry: str | None = None) -> dict:
        """Fetch most recent N emails from inbox."""
        params = {
            '$top':     max_results,
            '$orderby': 'receivedDateTime desc',
            '$select':  'id,subject,from,toRecipients,ccRecipients,receivedDateTime,'
                        'body,bodyPreview,isRead,flag,parentFolderId',
        }
        messages = []
        next_url = f'{GRAPH_BASE}/me/mailFolders/inbox/messages'
        next_params = params

        while next_url:
            resp = self._request_graph(
                'GET',
                next_url,
                access_token,
                refresh_token=refresh_token,
                token_expiry=token_expiry,
                params=next_params,
            )
            data = resp.json()
            messages.extend(data.get('value', []))
            next_url = data.get('@odata.nextLink')
            next_params = None

        emails = [self._parse_message(m) for m in messages]
        return {'emails': emails, 'is_full_sync': True}

    def fetch_emails_delta(self, access_token: str, delta_link: str | None,
                           max_results: int = 50, refresh_token: str | None = None,
                           token_expiry: str | None = None) -> dict | None:
        """Fetch messages changed since the last delta link."""
        request_url = delta_link or f'{GRAPH_BASE}/me/mailFolders/inbox/messages/delta'
        request_params = None if delta_link else {
            '$top':    max_results,
            '$select': 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,'
                       'body,bodyPreview,isRead,flag,parentFolderId',
        }

        try:
            emails = []
            next_url = request_url
            next_params = request_params
            delta_cursor = delta_link

            while next_url:
                resp = self._request_graph(
                    'GET',
                    next_url,
                    access_token,
                    refresh_token=refresh_token,
                    token_expiry=token_expiry,
                    params=next_params,
                )
                data = resp.json()

                emails.extend(
                    self._parse_message(m)
                    for m in data.get('value', [])
                    if not m.get('@removed')
                )

                next_url = data.get('@odata.nextLink')
                next_params = None
                if not next_url:
                    delta_cursor = data.get('@odata.deltaLink') or delta_cursor

            return {
                'emails': emails,
                'delta_link': delta_cursor,
                'is_full_sync': delta_link is None,
            }

        except requests.HTTPError as error:
            status = getattr(error.response, 'status_code', None)
            if status in {404, 410} and delta_link:
                print('Outlook delta cursor expired; caller should fall back to a full sync.', flush=True)
                return None
            raise

    def create_inbox_subscription(self, access_token: str, notification_url: str,
                                  client_state: str, ttl_minutes: int = 4200) -> dict:
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)).isoformat()
        payload = {
            'changeType': 'created,updated,deleted',
            'notificationUrl': notification_url,
            'resource': '/me/messages',
            'expirationDateTime': expires_at,
            'clientState': str(client_state),
        }

        resp = self._request_graph(
            'POST',
            f'{GRAPH_BASE}/subscriptions',
            access_token,
            json=payload,
        )
        return resp.json()

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
        #hard reset code #remove this comment later

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
