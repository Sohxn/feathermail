/**
 * Email Store - Single source of truth for all email data
 * Works across web, desktop, and mobile platforms
 * 
 * This store manages:
 * - Email accounts (Gmail, Outlook, etc.)
 * - Emails from all accounts
 * - Sync state and loading states
 * - Selected email and filters
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ============================================================
// TYPES - Define what our data looks like
// ============================================================

export interface EmailAccount {
  id: string;
  user_id: string;
  email_address: string;
  provider: 'gmail' | 'outlook' | 'yahoo' | 'imap';
  is_primary: boolean;
  is_connected: boolean;
  last_sync: string | null;
}

export interface Email {
  id: string;
  account_id: string;
  gmail_id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  to_email: string[];
  body_text: string;
  body_html: string | null;
  snippet: string | null;
  received_at: string;
  labels: string[];
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  is_trashed: boolean;
  
  // Joined data from account
  email_accounts?: {
    email_address: string;
    provider: string;
  };
}

// ============================================================
// STORE STATE - What data we keep in memory
// ============================================================

interface EmailState {
  // Data
  accounts: EmailAccount[];
  emails: Email[];
  
  // UI State
  selectedEmailId: string | null;
  selectedAccountId: string | null; // null = "All Accounts"
  activeFolder: 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'trash';
  
  // Loading States
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  cursor: string | null;       // received_at of the last loaded email
  hasMore: boolean;            // false when we've hit the end
  appendEmails: (emails: Email[]) => void;  // adds to existing list
  resetPagination: () => void; // call when switching folders/accounts
  
  // Actions (functions to modify state)
  setAccounts: (accounts: EmailAccount[]) => void;
  setEmails: (emails: Email[]) => void;
  setSelectedEmailId: (id: string | null) => void;
  setSelectedAccountId: (id: string | null) => void;
  setActiveFolder: (folder: EmailState['activeFolder']) => void;
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setError: (error: string | null) => void;
  setHasMore: (val: boolean) => void;
  
  // Email Operations
  markEmailAsRead: (emailId: string) => void;
  toggleEmailStar: (emailId: string) => void;
  archiveEmail: (emailId: string) => void;
  trashEmail: (emailId: string) => void;
  
  // Computed/Derived Data
  getFilteredEmails: () => Email[];
  getSelectedEmail: () => Email | null;
  getFolderCounts: () => Record<string, number>;

  
}

// ============================================================
// STORE IMPLEMENTATION
// ============================================================

export const useEmailStore = create<EmailState>()(
  immer((set, get) => ({
    // Initial state
    accounts: [],
    emails: [],
    selectedEmailId: null,
    selectedAccountId: null,
    activeFolder: 'inbox',
    isLoading: false,
    isSyncing: false,
    error: null,
    cursor: null,
    hasMore: true,

    // implementation
    setHasMore: (val) => set({ hasMore: val }),

    appendEmails: (newEmails) =>
    set((state) => {
      const existingIds = new Set(state.emails.map(e => e.id));
      const fresh = newEmails.filter(e => !existingIds.has(e.id));
      state.emails.push(...fresh);
      
      // Always keep newest-first regardless of insertion order
      state.emails.sort((a, b) =>
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      );

      // Cursor = oldest email seen (for pagination)
      if (state.emails.length > 0) {
        state.cursor = state.emails[state.emails.length - 1].received_at;
      }
  }),

  resetPagination: () =>
  set({ emails: [], cursor: null, hasMore: true }),
    
    // Simple setters - update one piece of state
    setAccounts: (accounts) => set({ accounts }),
    setEmails: (emails) => set({ emails }),
    setSelectedEmailId: (id) => set({ selectedEmailId: id }),
    setSelectedAccountId: (id) => set({ selectedAccountId: id }),
    setActiveFolder: (folder) => set({ activeFolder: folder }),
    setLoading: (loading) => set({ isLoading: loading }),
    setSyncing: (syncing) => set({ isSyncing: syncing }),
    setError: (error) => set({ error }),
    
    // Email operations - modify email state
    markEmailAsRead: (emailId) => 
      set((state) => {
        const email = state.emails.find(e => e.id === emailId);
        if (email) {
          email.is_read = true;
        }
      }),
    
    toggleEmailStar: (emailId) =>
      set((state) => {
        const email = state.emails.find(e => e.id === emailId);
        if (email) {
          email.is_starred = !email.is_starred;
        }
      }),
    
    archiveEmail: (emailId) =>
      set((state) => {
        const email = state.emails.find(e => e.id === emailId);
        if (email) {
          email.is_archived = true;
        }
      }),
    
    trashEmail: (emailId) =>
      set((state) => {
        const email = state.emails.find(e => e.id === emailId);
        if (email) {
          email.is_trashed = true;
        }
      }),
    
    // Computed values - calculate on demand
    getFilteredEmails: () => {
      const state = get();
      let filtered = state.emails;
      
      // Filter by account (if specific account selected)
      if (state.selectedAccountId) {
        filtered = filtered.filter(e => e.account_id === state.selectedAccountId);
      }
      
      // Filter by folder
      switch (state.activeFolder) {
        case 'inbox':
          filtered = filtered.filter(e => !e.is_archived && !e.is_trashed);
          break;
        case 'starred':
          filtered = filtered.filter(e => e.is_starred && !e.is_trashed);
          break;
        case 'sent':
          filtered = filtered.filter(e => e.labels?.includes('SENT') && !e.is_trashed);
          break;
        case 'drafts':
          filtered = [];
          break;
        case 'archive':
          filtered = filtered.filter(e => e.is_archived && !e.is_trashed);
          break;
        case 'trash':
          filtered = filtered.filter(e => e.is_trashed);
          break;
      }
      
      // Sort by received date (newest first)
      return filtered.sort((a, b) => 
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      );
    },
    
    getSelectedEmail: () => {
      const state = get();
      return state.emails.find(e => e.id === state.selectedEmailId) || null;
    },
    
    getFolderCounts: () => {
      const state = get();
      const filtered = state.selectedAccountId
        ? state.emails.filter(e => e.account_id === state.selectedAccountId)
        : state.emails;
      
      return {
        inbox: filtered.filter(e => !e.is_archived && !e.is_trashed && !e.is_read).length,
        starred: filtered.filter(e => e.is_starred && !e.is_trashed).length,
        sent: filtered.filter(e => e.labels?.includes('SENT') && !e.is_trashed).length,
        drafts: 0, // Not implemented yet
        archive: filtered.filter(e => e.is_archived && !e.is_trashed).length,
        trash: filtered.filter(e => e.is_trashed).length,
      };
    },
  }))
);