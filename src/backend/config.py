import os 
from dotenv import load_dotenv

load_dotenv()


#ONLY GOOGLE (gmail) API FOR NOW
class Config:
   #CONFIGURATION CREDS FOR ALL THE SERVICES WE WILL USE HERE
   #google 
   google_client_id = os.getenv('GOOGLE_CLIENT_ID')
   google_client_secret = os.getenv('GOOGLE_CLIENT_SECRET')

   redirect_uri = os.getenv('REDIRECT_URI')

   #supabase
   supabase_url = os.getenv('SUPABASE_URL')
   supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
    
   # Microsoft / Outlook (Microsoft Graph)
   microsoft_client_id     = os.getenv('MICROSOFT_CLIENT_ID')
   microsoft_client_secret = os.getenv('MICROSOFT_CLIENT_SECRET')
   microsoft_tenant_id     = os.getenv('MICROSOFT_TENANT_ID')
   # Redirect URI (fallback to generic redirect_uri)
   # Use the generic REDIRECT_URI for all providers to keep a single canonical callback
   microsoft_redirect_uri  = redirect_uri
    


