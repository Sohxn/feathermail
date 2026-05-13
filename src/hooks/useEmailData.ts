/**
 * Email Data Hook
 * Loads emails and accounts into the store
 * Syncs with backend
 */

import { useCallback } from 'react';
import { useEmailStore } from '@/store/emailStore';
import * as api from '@/services/apiClient';
import { toast } from 'sonner';
import { isDev } from '@/lib/devMode';
import { devEmailAccounts, getDevEmailsPage, hasMoreDevEmails, DEV_EMAIL_PAGE_SIZE } from '@/data/devEmails';
import { fetchEmailsPage } from '@/services/apiClient';

const PRODUCTION_PAGE_SIZE = 15;

export function useEmailData() {
  const store = useEmailStore();

  const loadDevData = () => {
    store.resetPagination();
    store.setAccounts(devEmailAccounts);

    const firstPage = getDevEmailsPage(null, DEV_EMAIL_PAGE_SIZE);
    store.appendEmails(firstPage);
    store.setHasMore(hasMoreDevEmails(null, DEV_EMAIL_PAGE_SIZE));

    if (firstPage.length > 0) {
      store.setSelectedEmailId(firstPage[0].id);
    }
  };

  const loadData = async () => {
    store.setLoading(true);
    store.setError(null);

    if (isDev) {
      loadDevData();
      store.setLoading(false);
      return;
    }

    try {
      store.resetPagination();
      const user = await api.getCurrentUser();
      if (!user) {
        store.setLoading(false);
        return;
      }

      const [accounts, emails] = await Promise.all([
        api.fetchEmailAccounts(),
        fetchEmailsPage(null),
      ]);

      store.setAccounts(accounts);
      store.appendEmails(emails);
      store.setHasMore(emails.length === PRODUCTION_PAGE_SIZE);

      if (emails.length > 0) {
        store.setSelectedEmailId(emails[0].id);
      }
    } catch (error: any) {
      if (error.message !== 'Not authenticated') {
        store.setError(error.message);
        toast.error('Failed to load emails');
      }
    } finally {
      store.setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (!store.hasMore || store.isSyncing) return;

    try {
      store.setSyncing(true);

      if (isDev) {
        const emails = getDevEmailsPage(store.cursor, DEV_EMAIL_PAGE_SIZE);
        store.appendEmails(emails);
        store.setHasMore(hasMoreDevEmails(store.cursor, DEV_EMAIL_PAGE_SIZE));
        return;
      }

      const emails = await fetchEmailsPage(store.cursor);
      store.appendEmails(emails);

      if (emails.length < PRODUCTION_PAGE_SIZE) {
        store.setHasMore(false);
      }
    } catch (error: any) {
      console.error('Load more failed:', error);
    } finally {
      store.setSyncing(false);
    }
  }, [store.cursor, store.hasMore, store.isSyncing]);

  const syncSilent = useCallback(async () => {
    if (isDev) return;

    try {
      await api.syncEmails();
      store.resetPagination();
      const emails = await fetchEmailsPage(null, PRODUCTION_PAGE_SIZE);
      store.appendEmails(emails);
      store.setHasMore(emails.length === PRODUCTION_PAGE_SIZE);
    } catch (error: any) {
      console.error('Background sync failed:', error);
    }
  }, []);

  const sync = async () => {
    if (isDev) {
      toast.info('dev mode: local inbox is already using mock production-shaped mail');
      return;
    }

    try {
      store.setSyncing(true);
      const result = await api.syncEmails();
      store.resetPagination();
      const emails = await fetchEmailsPage(null, PRODUCTION_PAGE_SIZE);
      store.appendEmails(emails);
      store.setHasMore(emails.length === PRODUCTION_PAGE_SIZE);

      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} new emails`);
      } else {
        toast.info('No new emails');
      }
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