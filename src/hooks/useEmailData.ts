import { useCallback, useEffect } from 'react';
import { useEmailStore } from '@/store/emailStore';
import * as api from '@/services/apiClient';
import { toast } from 'sonner';
import { isDev } from '@/lib/devMode';
import {
  devEmailAccounts,
  getDevEmailsPage,
  hasMoreDevEmails,
  DEV_EMAIL_PAGE_SIZE,
  DEV_EMAIL_ROTATION_INTERVAL_MS,
  rotateDevEmails,
} from '@/data/devEmails';
import { fetchEmailsPage } from '@/services/apiClient';

const PRODUCTION_PAGE_SIZE = 15;

export function useEmailData() {
  const store = useEmailStore();  

  const loadDevData = () => {
    store.resetPagination();
    store.setAccounts(devEmailAccounts);

    const firstPage = getDevEmailsPage(null, DEV_EMAIL_PAGE_SIZE);
    store.setEmails(firstPage);
    store.setHasMore(hasMoreDevEmails(null));

    if (firstPage.length > 0) {
      store.setSelectedEmailId(firstPage[0].id);
    }
  };

  // Dev‑mode rotation for the playground inbox
  useEffect(() => {
    if (!isDev || store.emails.length === 0) {
      return;
    }

    const rotationTimer = window.setInterval(() => {
      const currentEmails = useEmailStore.getState().emails;
      const nextEmails = rotateDevEmails(currentEmails);

      if (nextEmails.length === 0) {
        return;
      }

      const currentSelectedId = useEmailStore.getState().selectedEmailId;
      useEmailStore.getState().setEmails(nextEmails);

      const selectedStillExists = nextEmails.some(
        (email) => email.id === currentSelectedId,
      );
      if (!selectedStillExists) {
        useEmailStore.getState().setSelectedEmailId(nextEmails[0].id);
      }
    }, DEV_EMAIL_ROTATION_INTERVAL_MS);

    return () => window.clearInterval(rotationTimer);
  }, [store.emails.length]);

  /**
   * Full reload for the current user.
   * This is used on first load or when the authenticated user changes.
   */
  const loadData = async (force = false) => {
    store.setLoading(true);
    store.setError(null);

    if (isDev) {
      loadDevData();
      store.setLoading(false);
      return true;
    }

    try {
      const user = await api.getCurrentUser();
      if (!user) {
        store.setLoading(false);
        return false;
      }

      // If we already loaded this user and not forcing, skip reload
      if (!force && store.loadedUserId === user.id && store.emails.length > 0) {
        store.setLoading(false);
        return false;
      }

      // Full reload: clear cache + pagination state
      store.resetPagination();

      const [accounts, emails] = await Promise.all([
        api.fetchEmailAccounts(),
        fetchEmailsPage(null, PRODUCTION_PAGE_SIZE),
      ]);

      store.setAccounts(accounts);
      store.appendEmails(emails);
      store.setLoadedUserId(user.id);
      store.setHasMore(emails.length === PRODUCTION_PAGE_SIZE);

      if (emails.length > 0) {
        store.setSelectedEmailId(emails[0].id);
      }
      return true;
    } catch (error: any) {
      if (error.message !== 'Not authenticated') {
        store.setError(error.message);
        toast.error('Failed to load emails');
      }
      return false;
    } finally {
      store.setLoading(false);
    }
  };

  /**
   * Load next page of emails (older than current cursor).
   * Uses the global mailbox cursor; filtering by account/folder
   * is done in the store for the currently selected view.
   */
  const loadMore = useCallback(async () => {
    if (!store.hasMore || store.isSyncing) return;

    try {
      store.setSyncing(true);

      if (isDev) {
        return;
      }

      const emails = await fetchEmailsPage(store.cursor, PRODUCTION_PAGE_SIZE);
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

  /**
   * Background sync:
   * - Ask backend to sync across providers
   * - Merge newest page into local cache
   * - Do NOT clear previously loaded emails
   */
  const syncSilent = useCallback(async () => {
    if (isDev) return;

    try {
      await api.syncEmails();

      const emails = await fetchEmailsPage(null, PRODUCTION_PAGE_SIZE);
      store.appendEmails(emails);
      // We keep hasMore true if we already knew there was more or this page is full
      if (emails.length < PRODUCTION_PAGE_SIZE && !store.hasMore) {
        store.setHasMore(false);
      } else if (emails.length === PRODUCTION_PAGE_SIZE) {
        store.setHasMore(true);
      }
    } catch (error: any) {
      console.error('Background sync failed:', error);
    }
  }, [store.hasMore]);

  /**
   * Manual sync:
   * - Same merge behavior as syncSilent, but with toasts.
   */
  const sync = async () => {
    if (isDev) {
      toast.info(
        'dev mode: local inbox is already using mock production-shaped mail',
      );
      return;
    }

    try {
      store.setSyncing(true);

      const result = await api.syncEmails();

      const emails = await fetchEmailsPage(null, PRODUCTION_PAGE_SIZE);
      store.appendEmails(emails);

      if (emails.length < PRODUCTION_PAGE_SIZE && !store.hasMore) {
        store.setHasMore(false);
      } else if (emails.length === PRODUCTION_PAGE_SIZE) {
        store.setHasMore(true);
      }

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