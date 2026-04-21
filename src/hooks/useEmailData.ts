/**
 * Email Data Hook
 * Loads emails and accounts into the store
 * Syncs with backend
 */

import { useEffect, useCallback } from 'react';
import { useEmailStore } from '@/store/emailStore';
import * as api from '@/services/apiClient';
import { toast } from 'sonner';
import { isDev } from '@/lib/devMode';
import { mockEmails } from '@/data/mockEmails';
import { fetchEmailsPage } from '@/services/apiClient';

export function useEmailData() {
  const store = useEmailStore();
  
  /**
   * Load accounts and emails from database
   * Called on initial page load
   */
  // const loadData = async () => {
  //   // dev mode
  //   if(isDev){
  //     store.setEmails(mockEmails);
  //     store.setAccounts(
  //       [
  //         {
  //           id: 'dev-account-1',
  //           user_id: 'sohxn_001',
  //           email_address: 'sohxn@devtest.com',
  //           provider: 'gmail',
  //           is_primary: true,
  //           is_connected: true,
  //           last_sync: null,
  //         }
  //       ]
  //     );
    
  //     if(mockEmails.length > 0){
  //       store.setSelectedEmailId(mockEmails[0].id);
  //     }

  //     store.setLoading(false);
  //     return;
  //   }
    
    
  //   try {
  //     store.setLoading(true);
  //     store.setError(null);
      
  //     // Check if user is authenticated first
  //     const user = await api.getCurrentUser();
  //     if (!user) {
  //       console.log('No user - skipping data load');
  //       store.setLoading(false);
  //       return;
  //     }
      
  //     // Load in parallel for speed
  //     const [accounts, emails] = await Promise.all([
  //       api.fetchEmailAccounts(),
  //       api.fetchEmails(),
  //     ]);
      
  //     store.setAccounts(accounts);
  //     store.setEmails(emails);
      
  //     // Auto-select first email if none selected
  //     if (emails.length > 0 && !store.selectedEmailId) {
  //       store.setSelectedEmailId(emails[0].id);
  //     }
      
  //   } catch (error: any) {
  //     console.error('Failed to load data:', error);
      
  //     // Don't show error if it's just "not authenticated"
  //     if (error.message !== 'Not authenticated') {
  //       store.setError(error.message);
  //       toast.error('Failed to load emails');
  //     }
  //   } finally {
  //     store.setLoading(false);
  //   }
  // };


  const loadData = async () => {
  if (isDev) {
    store.setEmails(mockEmails);
    store.setAccounts([{
      id: 'dev-account-1',
      user_id: 'sohxn_001',
      email_address: 'sohxn@devtest.com',
      provider: 'gmail',
      is_primary: true,
      is_connected: true,
      last_sync: null,
    }]);
    if (mockEmails.length > 0) store.setSelectedEmailId(mockEmails[0].id);
    store.setLoading(false);
    return;
  }

  try {
    store.setLoading(true);
    store.resetPagination(); // clear old emails when reloading
    const user = await api.getCurrentUser();
    if (!user) { store.setLoading(false); return; }

    const [accounts, emails] = await Promise.all([
      api.fetchEmailAccounts(),
      fetchEmailsPage(null), // first page, no cursor
    ]);

    store.setAccounts(accounts);
    store.appendEmails(emails);

    // If we got less than 15, there's nothing more to load
    if (emails.length < 15) store.set({ hasMore: false }); // ← see note below
    if (emails.length > 0) store.setSelectedEmailId(emails[0].id);
  } catch (error: any) {
    if (error.message !== 'Not authenticated') {
      store.setError(error.message);
      toast.error('Failed to load emails');
    }
  } finally {
    store.setLoading(false);
  }
};

// New function — called when user scrolls to bottom
const loadMore = useCallback(async () => {
  if (isDev || !store.hasMore || store.isSyncing) return;
  try {
    store.setSyncing(true);
    const emails = await fetchEmailsPage(store.cursor);
    store.appendEmails(emails);
    if (emails.length < 15) {
      // reached the end
      // need to expose a setHasMore in the store (add it same way as other setters)
      store.setHasMore(false);
    }
  } catch (error: any) {
    console.error('Load more failed:', error);
  } finally {
    store.setSyncing(false);
  }
}, [store.cursor, store.hasMore]);


  
  /**
   * Sync emails from Gmail
   * Called when user clicks "Sync" button
   */
  const syncSilent = useCallback(async () => {
    if (isDev) return;
    try {
        await api.syncEmails();
        store.resetPagination();
        const emails = await fetchEmailsPage(null, 15);
        store.appendEmails(emails);
        if (emails.length < 15) store.setHasMore(false);
    } catch (error: any) {
        console.error('Background sync failed:', error);
        // silent — don't toast on background sync
    }
  }, []);  

  const sync = async () => {
    if (isDev) { toast.info('dev mode: loading mock emails'); return; }
    try {
        store.setSyncing(true);
        const result = await api.syncEmails();
      store.resetPagination();
      const emails = await fetchEmailsPage(null, 15);
      store.appendEmails(emails);
      if (emails.length < 15) store.setHasMore(false);
        if (result.synced > 0) toast.success(`Synced ${result.synced} new emails`);
        else toast.info('No new emails');
    } catch (error: any) {
        toast.error('Failed to sync emails');
    } finally {
        store.setSyncing(false);
    }
  };

  
  return {
    loadData,
    sync,
    syncSilent,
    loadMore,
    isLoading: store.isLoading,
    isSyncing: store.isSyncing,
    error: store.error,
  };
}