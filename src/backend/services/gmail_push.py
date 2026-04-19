from google.cloud import pubsub_v1
from googleapiclient.discovery import build
import os

class GmailPushService:
    def __init__(self, gmail_service):
        self.gmail_service = gmail_service
        
    def watch_inbox(self, user_email, access_token, refresh_token):
        service = self.gmail_service.get_gmail_service(access_token, refresh_token)
        project_id = os.getenv('GOOGLE_CLOUD_PROJECT_ID')

        request = {
            'labelIds': ['INBOX'],
            'topicName': f'projects/{GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-push'  # You create this once
        }

        result = service.users().watch(userId='me', body=request).execute()
        
        #logging
        print(f"Watch set for {user_email}: expiry={result.get('expiration')}", flush=True)

        return 