import { supabase } from './supabase';

const MICROSOFT_CLIENT_ID =
  import.meta.env.VITE_MICROSOFT_CLIENT_ID || import.meta.env.VITE_OUTLOOK_CLIENT_ID;
const MICROSOFT_REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;
const MICROSOFT_TENANT = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'; // allows personal + work accounts

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'User.Read',
].join(' ');

export function initiateOutlookAuth() {
  localStorage.setItem('outlook_auth', 'true');

  const authUrl =
    `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize?` +
    `client_id=${MICROSOFT_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(MICROSOFT_REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(SCOPES)}&` +
    `response_mode=query&` +
    `prompt=select_account`;

  window.location.href = authUrl;
}

export default initiateOutlookAuth;
