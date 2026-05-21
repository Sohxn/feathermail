/**
 * API Client - Talks to backend
 * Platform-agnostic: works on web, desktop, mobile
 * 
 * All backend communication goes through this file
 * Makes it easy to switch backends or add caching later
 */

import { supabase } from '@/lib/supabase';

// ============================================================
// CONFIGURATION
// ============================================================

// Backend URL comes from the environment so deployed builds talk to Render,
// while local development still falls back to localhost.
const API_BASE_URL = import.meta.env.VITE_FLASK_API_URL || 'http://localhost:5000';

// imap
export interface ImapConnectPayload {
  provider: 'yahoo' | 'outlook' | 'imap';
  email: string;
  password: string;
  // Only needed when provider === 'imap' (custom domain):
  imap_host?: string;
  imap_port?: number;
  smtp_host?: string;
  smtp_port?: number;
}
 
export async function connectImapAccount(payload: ImapConnectPayload) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
 
  return apiRequest('/api/imap/connect', {
    method: 'POST',
    body: JSON.stringify({ ...payload, user_id: user.id }),
  });
}


/**
 * Helper function to make API requests
 * Automatically adds auth headers and handles errors
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================
// AUTHENTICATION
// ============================================================

/**
 * Get current authenticated user
 */
// export async function getCurrentUser() {
//   const { data: { user }, error } = await supabase.auth.getUser();
//   if (error) throw error;
//   return user;
// }

/**
 * Get current authenticated user
 * Returns null if not authenticated (doesn't throw)
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // Don't throw on "no session" error - just return null
  if (error && error.message === 'Auth session missing!') {
    return null;
  }
  
  if (error) throw error;
  return user;
}

/**
 * Sign up new user
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign in existing user
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ============================================================
// EMAIL ACCOUNTS
// ============================================================

/**
 * Get all email accounts for current user
 */
export async function fetchEmailAccounts() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * Connect a Gmail account via OAuth
 */
export async function connectGmailAccount(authCode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  return apiRequest('/api/gmail/oauth/callback', {
    method: 'POST',
    body: JSON.stringify({
      code: authCode,
      user_id: user.id,
    }),
  });
}

/**
 * Connect an Outlook account (Microsoft Graph) via OAuth
 */
export async function connectOutlookAccount(authCode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  return apiRequest('/api/outlook/oauth/callback', {
    method: 'POST',
    body: JSON.stringify({ code: authCode, user_id: user.id }),
  });
}

/**
 * Remove an email account
 */
export async function removeEmailAccount(accountId: string) {
  const { error } = await supabase
    .from('email_accounts')
    .delete()
    .eq('id', accountId);
  
  if (error) throw error;
}

/**
 * Set account as primary
 */
export async function setPrimaryAccount(accountId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  // First, unset all primary flags
  await supabase
    .from('email_accounts')
    .update({ is_primary: false })
    .eq('user_id', user.id);
  
  // Then set this one as primary
  const { error } = await supabase
    .from('email_accounts')
    .update({ is_primary: true })
    .eq('id', accountId);
  
  if (error) throw error;
}

// ============================================================
// EMAILS
// ============================================================

/**
 * Fetch all emails for current user from database
 * This is FAST - just reads from Supabase
 */
export async function fetchEmails() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('emails')
    .select(`
      *,
      email_accounts (
        email_address,
        provider
      )
    `)
    .eq('user_id', user.id)
    .order('received_at', { ascending: false })
    .limit(100);
  
  if (error) throw error;
  return data;
}


/**
PAGINATION
**/
export async function fetchEmailsPage(cursor: string | null, limit = 15) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('emails')
    .select('*, email_accounts(email_address, provider)')
    .eq('user_id', user.id)
    .order('received_at', { ascending: false })
    .limit(limit);

  // If we have a cursor, only fetch emails older than it
  if (cursor) {
    query = query.lt('received_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}



/**
 * Sync emails from Gmail API to database
 * This is SLOW - fetches from Gmail, then saves to Supabase
 */
export async function syncEmails() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
 
  const accounts = await fetchEmailAccounts();
 
  const gmailAccounts   = accounts.filter((a: any) => a.provider === 'gmail');
  const outlookAccounts = accounts.filter((a: any) => a.provider === 'outlook');
  const imapAccounts    = accounts.filter((a: any) => !['gmail', 'outlook'].includes(a.provider));

  const results = await Promise.allSettled([
    gmailAccounts.length > 0
      ? apiRequest('/api/gmail/sync', {
          method: 'POST',
          body: JSON.stringify({ user_id: user.id }),
        })
      : Promise.resolve({ synced: 0 }),

    outlookAccounts.length > 0
      ? apiRequest('/api/outlook/sync', {
          method: 'POST',
          body: JSON.stringify({ user_id: user.id }),
        })
      : Promise.resolve({ synced: 0 }),

    ...imapAccounts.map((a: any) =>
      apiRequest('/api/imap/sync', {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id, account_id: a.id }),
      })
    ),
  ]);
 
  // Tally up total synced across all providers
  let totalSynced = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      totalSynced += (r.value as any)?.synced ?? 0;
    } else {
      console.error('Sync error for one account:', r.reason);
    }
  }
 
  return { synced: totalSynced, accounts_synced: accounts.length };
}


// SENDING MAILS 
// 1. Gmail
export async function sendEmail(to:string, subject:string, body:string): Promise<void> {
  // checking auth
  const user = await getCurrentUser();
  if(!user) throw new Error ('NOT AUTHENTICATED');

  await apiRequest('/api/gmail/send',{method: 'POST', body: JSON.stringify({
      user_id: user.id,
      to,
      subject,
      body,
    }),
  });
}

// adding other providers later after MVP is ready



// MISC FUNCTIONS IN INBOX

// decide if we store this locally too and database ONLY WHEN ITS NEEDED because no point in increasing api costs this much
/**
 * Mark email as read in database
 */
export async function markEmailAsRead(emailId: string) {
  const { error } = await supabase
    .from('emails')
    .update({ is_read: true })
    .eq('id', emailId);
  
  if (error) throw error;
}

/**
 * Toggle email star in database
 */
export async function toggleEmailStar(emailId: string, isStarred: boolean) {
  const { error } = await supabase
    .from('emails')
    .update({ is_starred: !isStarred })
    .eq('id', emailId);
  
  if (error) throw error;
}

/**
 * Archive email in database
 */
export async function archiveEmail(emailId: string) {
  const { error } = await supabase
    .from('emails')
    .update({ is_archived: true })
    .eq('id', emailId);
  
  if (error) throw error;
}

/**
 * Move email to trash in database
 */
export async function trashEmail(emailId: string) {
  const { error } = await supabase
    .from('emails')
    .update({ is_trashed: true })
    .eq('id', emailId);
  
  if (error) throw error;
}

// ============================================================
// SUMMARY
// ============================================================
/**
 * Request a summary from the backend. We only send the raw email body and the email row id.
 */
export async function summarize(emailBody: string, emailId: string) {
  return apiRequest('/api/summarize', {
    method: 'POST',
    body: JSON.stringify({ email_body: emailBody, email_id: emailId }),
  });
}