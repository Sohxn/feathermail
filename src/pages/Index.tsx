import { useRef, useEffect, useMemo, useState, useCallback} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEmailData } from "@/hooks/useEmailData";
import { Email, useEmailStore } from "@/store/emailStore";
import { toast } from "sonner";
import EmailSidebar from "@/components/email/EmailSidebar";
import EmailListItem from "@/components/email/EmailListItem";
import EmailView from "@/components/email/EmailView";
import { ComposeModal, ComposeInitData } from "@/components/email/ComposeModal";
import { RefreshCw, Menu, ArrowLeft, PenSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isDev } from "@/lib/devMode";

type MobilePanel = "sidebar" | "list" | "email";

export default function Index() {
  const navigate = useNavigate();
  const { loadData, sync, syncSilent, loadMore, isLoading, isSyncing } = useEmailData();
  
  // sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("list");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState<ComposeInitData | undefined>();

  const openCompose = useCallback((initialData?: ComposeInitData) => {
    setComposeData(initialData);
    setIsComposeOpen(true);
  }, []);

  const closeCompose = useCallback(() => {
    setIsComposeOpen(false);
    setTimeout(() => setComposeData(undefined), 300);
  }, []);

  const accounts          = useEmailStore(state => state.accounts);
  const allEmails         = useEmailStore(state => state.emails);
  const selectedEmailId   = useEmailStore(state => state.selectedEmailId);
  const selectedAccountId = useEmailStore(state => state.selectedAccountId);
  const activeFolder      = useEmailStore(state => state.activeFolder);
  const setSelectedEmailId   = useEmailStore(state => state.setSelectedEmailId);
  const setSelectedAccountId = useEmailStore(state => state.setSelectedAccountId);
  const setActiveFolder      = useEmailStore(state => state.setActiveFolder);

  const emails = useMemo(() => {
    let filtered = allEmails;
    if (selectedAccountId) filtered = filtered.filter(e => e.account_id === selectedAccountId);
    switch (activeFolder) {
      case "inbox":   filtered = filtered.filter(e => !e.is_archived && !e.is_trashed); break;
      case "starred": filtered = filtered.filter(e => e.is_starred && !e.is_trashed); break;
      case "sent":    filtered = filtered.filter(e => e.labels?.includes("SENT") && !e.is_trashed); break;
      case "drafts":  filtered = []; break;
      case "archive": filtered = filtered.filter(e => e.is_archived && !e.is_trashed); break;
      case "trash":   filtered = filtered.filter(e => e.is_trashed); break;
    }
    return [...filtered].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
  }, [allEmails, selectedAccountId, activeFolder]);

  const selectedEmail = useMemo(
    () => allEmails.find(e => e.id === selectedEmailId) ?? null,
    [allEmails, selectedEmailId]
  );

  const folderCounts = useMemo(() => {
    const base = selectedAccountId ? allEmails.filter(e => e.account_id === selectedAccountId) : allEmails;
    return {
      inbox:   base.filter(e => !e.is_archived && !e.is_trashed && !e.is_read).length,
      starred: base.filter(e => e.is_starred && !e.is_trashed).length,
      sent: base.filter(e => e.labels?.includes("SENT") && !e.is_trashed).length,
      drafts: 0,
      archive: base.filter(e => e.is_archived && !e.is_trashed).length,
      trash:   base.filter(e => e.is_trashed).length,
    };
  }, [allEmails, selectedAccountId]);



    // useEffect
    useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // When the sentinel becomes visible, load next page
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 } // fire when 10% of sentinel is visible
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);



  useEffect(() => {
    if (emails.length === 0) {
      if (selectedEmailId !== null) setSelectedEmailId(null);
      return;
    }

    const hasSelectedInCurrentFolder = emails.some(e => e.id === selectedEmailId);
    if (!hasSelectedInCurrentFolder) {
      setSelectedEmailId(emails[0].id);
    }
  }, [emails, selectedEmailId, setSelectedEmailId]);


  // show db mails instantly 
  // sync occurs in the background silently 
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate("/login"); return; }
    loadData();
    syncSilent(); 
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => syncSilent(), 30000);
    return () => clearInterval(id);
  }, [isAuthenticated, syncSilent]);

  useEffect(() => {
    if (!isAuthenticated || isDev) return;
    const channel = supabase.channel('emails-realtime').on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'emails' },
      (payload) => {
        const newEmail = payload.new as Email;
        const cur = useEmailStore.getState().emails;
        useEmailStore.getState().setEmails([newEmail, ...cur]);
        toast.success(`New email from ${newEmail.from_name || newEmail.from_email}`);
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading emails...</p>
        </div>
      </div>
    );
  }

  const selectedAccountName = selectedAccountId
    ? accounts.find(a => a.id === selectedAccountId)?.email_address ?? "Unknown"
    : "All Accounts";

  return (
    <div className="h-screen flex overflow-hidden">

      {/* ── SIDEBAR ── */}
      <div className={`
        flex-shrink-0 h-full overflow-y-auto
        md:block md:w-56
        ${mobilePanel === "sidebar" ? "block w-full absolute inset-0 z-20 bg-transparent" : "hidden"}
      `}>
        <EmailSidebar
          activeFolder={activeFolder}
          onFolderChange={(f) => { setActiveFolder(f as any); setMobilePanel("list"); }}
          onCompose={() => { openCompose(); setMobilePanel("list"); }}
          onOpenSettings={() => toast.info("Settings coming soon")}
          folderCounts={folderCounts}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={(id) => { setSelectedAccountId(id); setMobilePanel("list"); }}
          onClose={() => setMobilePanel("list")}
        />
      </div>

      {/* ── EMAIL LIST ── */}
      <div className={`
        flex-shrink-0 h-full flex flex-col
        md:flex md:w-96 md:border-r md:border-border
        ${mobilePanel === "list" ? "flex w-full" : "hidden"}
      `}>
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between flex-shrink-0 glass rounded-xl m-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobilePanel("sidebar")}
              className="md:hidden p-1 hover:bg-secondary rounded-md transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-[#ffffff]">
                {activeFolder.charAt(0).toUpperCase() + activeFolder.slice(1)}
              </h1>
              <p className="text-xs text-muted-foreground">{selectedAccountName}</p>
            </div>
          </div>
          <button
            onClick={sync}
            disabled={isSyncing}
            className="p-2 hover:bg-secondary rounded-full transition-colors glass rounded-full disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Email items — relative so FAB can be positioned inside */}
        <div className="flex-1 overflow-y-scroll scrollbar-hide m-2">
          {emails.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="mb-4">No emails</p>
              <button onClick={sync} className="px-4 py-2 bg-foreground text-background rounded-md hover:opacity-90">
                Sync Emails
              </button>
            </div>
          ) : (
            <>
              {emails.map(email => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  isSelected={email.id === selectedEmailId}
                  onClick={() => { setSelectedEmailId(email.id); setMobilePanel("email"); }}
                />
              ))}

              {/* Sentinel — invisible div that triggers load more */}
              <div ref={sentinelRef} className="h-4 w-full" />

              {/* Show a small spinner while loading next page */}
              {isSyncing && (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                </div>
              )}
            </>
          )}

          {/* FAB — mobile only, bottom-right of the list panel */}
          <button
            onClick={() => openCompose()}
            className="
              md:hidden
              fixed bottom-6 right-6
              w-14 h-14 rounded-full
              bg-foreground text-background
              flex items-center justify-center
              shadow-lg hover:opacity-90 active:scale-95
              transition-all z-10
            "
            title="Compose"
          >
            <PenSquare className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* ── EMAIL VIEW ── */}
      <div className={`
        min-w-0 h-full flex flex-col
        md:flex md:flex-1
        ${mobilePanel === "email" ? "flex w-full" : "hidden"}
      `}>
        {/* Mobile back button */}
        <div className="md:hidden h-12 px-4 flex items-center border-b border-border glass m-2 flex-shrink-0">
          <button
            onClick={() => setMobilePanel("list")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedEmail ? (
            <EmailView
              email={selectedEmail}
              onReply={(data) => openCompose(data)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Select an email to read
            </div>
          )}
        </div>
      </div>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={closeCompose}
        initData={composeData}
      />
    </div>
  );
}