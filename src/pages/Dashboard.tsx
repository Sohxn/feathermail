import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEmailStore } from "@/store/emailStore";
import { initiateGmailAuth } from "@/lib/google_auth";
import { initiateOutlookAuth } from "@/lib/outlook_auth";
import * as api from "@/services/apiClient";
import { connectImapAccount, ImapConnectPayload } from "@/services/apiClient";
import { toast } from "sonner";
import { X, Loader2, Eye, EyeOff } from "lucide-react";

// Known provider server settings — mirrors PROVIDER_SETTINGS in app.py
const PROVIDER_PRESETS: Record<string, { imap_host: string; imap_port: number; smtp_host: string; smtp_port: number }> = {
  yahoo: {
    imap_host: 'imap.mail.yahoo.com', imap_port: 993,
    smtp_host: 'smtp.mail.yahoo.com', smtp_port: 465,
  },
  outlook: {
    imap_host: 'outlook.office365.com', imap_port: 993,
    smtp_host: 'smtp.office365.com',    smtp_port: 587,
  },
};

const BLANK_FORM: ImapConnectPayload & { imap_host: string; imap_port: number; smtp_host: string; smtp_port: number } = {
  provider: 'yahoo',
  email: '',
  password: '',
  imap_host: PROVIDER_PRESETS.yahoo.imap_host,
  imap_port: PROVIDER_PRESETS.yahoo.imap_port,
  smtp_host: PROVIDER_PRESETS.yahoo.smtp_host,
  smtp_port: PROVIDER_PRESETS.yahoo.smtp_port,
};

export default function Dashboard() {
  const navigate  = useNavigate();
  const { user, signOut, isAuthenticated, loading: authLoading } = useAuth();

  const [loading,  setLoading]  = useState(true);
  const [syncing,  setSyncing]  = useState(false);

  // ── remove-account panel ──
  const [removePanelOpen, setRemovePanelOpen] = useState(false);

  // ── IMAP connect form ──
  const [showImapForm,  setShowImapForm]  = useState(false);
  const [imapForm,      setImapForm]      = useState({ ...BLANK_FORM });
  const [imapConnecting, setImapConnecting] = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);

  const accounts    = useEmailStore(state => state.accounts);
  const setAccounts = useEmailStore(state => state.setAccounts);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate("/login"); return; }
    loadAccounts();
  }, [isAuthenticated, authLoading, navigate]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await api.fetchEmailAccounts();
      setAccounts(data);
    } catch (err: any) {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  // ── provider change ───────────────────────────────────────────────────────
  const handleProviderChange = (provider: string) => {
    const preset = PROVIDER_PRESETS[provider];
    setImapForm(f => ({
      ...f,
      provider: provider as any,
      ...(preset ?? { imap_host: '', imap_port: 993, smtp_host: '', smtp_port: 465 }),
    }));
  };

  // ── connect IMAP ──────────────────────────────────────────────────────────
  const handleConnectImap = async () => {
    if (!imapForm.email || !imapForm.password) {
      toast.error('Email and password are required');
      return;
    }
    if (imapForm.provider === 'imap' && !imapForm.imap_host) {
      toast.error('IMAP server is required for custom domains');
      return;
    }
    try {
      setImapConnecting(true);
      await connectImapAccount(imapForm);
      toast.success(`${imapForm.email} connected!`);
      setShowImapForm(false);
      setImapForm({ ...BLANK_FORM });
      await loadAccounts();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to connect account');
    } finally {
      setImapConnecting(false);
    }
  };

  const handleAddGmail = () => {
    localStorage.setItem('adding_account', 'true');
    initiateGmailAuth();
  };

  const handleAddOutlook = () => {
    localStorage.setItem('adding_account', 'true');
    initiateOutlookAuth();
  };

  const handleGoToInbox = () => {
    if (accounts.length === 0) { toast.error('Add an account first'); return; }
    navigate("/inbox");
  };

  const handleRemoveAccount = async (accountId: string) => {
    if (!confirm('Remove this account? All synced emails will be deleted.')) return;
    try {
      await api.removeEmailAccount(accountId);
      await loadAccounts();
      toast.success('Account removed');
    } catch { toast.error('Failed to remove account'); }
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      await api.setPrimaryAccount(accountId);
      await loadAccounts();
      toast.success('Primary account updated');
    } catch { toast.error('Failed to update primary'); }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      const result = await api.syncEmails();
      result.synced > 0
        ? toast.success(`Synced ${result.synced} emails`)
        : toast.info('No new emails');
    } catch { toast.error('Failed to sync'); } finally { setSyncing(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Magnolia Script', cursive" }}>Feathermail</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground rounded-2xl p-2 border-2">{user?.email}</span>
            <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground">Log out</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Email Accounts</h2>
          <p className="text-muted-foreground">Manage your connected accounts. All emails appear in a unified inbox.</p>
        </div>

        {/* ── Account list ── */}
        <div className="space-y-4 mb-8">
          {accounts.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-foreground/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">No accounts connected</h3>
              <p className="text-muted-foreground mb-6">Add your first email account to get started</p>
              <div className="flex gap-3 justify-center">
                <button onClick={handleAddGmail} className="px-4 py-2 glass rounded-xl hover:opacity-90">
                  Connect Gmail
                </button>
                <button onClick={handleAddOutlook} className="px-4 py-2 glass rounded-xl hover:opacity-90">
                  Connect Outlook
                </button>
                <button onClick={() => setShowImapForm(true)} className="px-4 py-2 glass rounded-xl hover:opacity-90">
                  Connect Yahoo / Other
                </button>
              </div>
            </div>
          ) : (
            <>
              {accounts.map(account => (
                <div key={account.id}
                  className="border glass rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-foreground/10 rounded-full flex items-center justify-center text-lg font-bold">
                      {/* Provider icon — Gmail gets the envelope SVG, others get initials */}
                      {account.provider === 'gmail' ? (
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
                        </svg>
                      ) : (
                        <span className="text-sm">{account.email_address[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.email_address}</span>
                        {account.is_primary && (
                          <span className="text-xs glass px-2 py-0.5 rounded-full">Primary</span>
                        )}
                        <span className="text-xs text-muted-foreground capitalize">{account.provider}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {account.last_sync
                          ? `Last synced ${new Date(account.last_sync).toLocaleString()}`
                          : 'Never synced'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!account.is_primary && (
                      <button onClick={() => handleSetPrimary(account.id)}
                        className="text-sm text-muted-foreground hover:text-foreground px-3 py-1 rounded-md hover:bg-secondary">
                        Set primary
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add more accounts */}
              <div className="flex gap-3">
                <button onClick={handleAddGmail}
                  className="flex-1 border border-dashed border-border rounded-xl p-4 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors text-sm">
                  + Add Gmail account
                </button>
                <button onClick={handleAddOutlook}
                  className="flex-1 border border-dashed border-border rounded-xl p-4 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors text-sm">
                  + Add Outlook account
                </button>
                <button onClick={() => setShowImapForm(true)}
                  className="flex-1 border border-dashed border-border rounded-xl p-4 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors text-sm">
                  + Add Yahoo / Other
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Action buttons ── */}
        {accounts.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleGoToInbox} className="px-6 py-3 glass rounded-2xl hover:opacity-90 font-medium">
              Go to Inbox →
            </button>
            <button onClick={handleSyncAll} disabled={syncing}
              className="px-6 py-3 glass rounded-2xl hover:opacity-90 font-medium disabled:opacity-50">
              {syncing ? 'Syncing…' : 'Sync All Accounts'}
            </button>
            <button onClick={() => setRemovePanelOpen(true)}
              className="px-6 py-3 glass rounded-2xl text-red-400 hover:text-red-300">
              Remove Accounts
            </button>
          </div>
        )}

        {/* ── Remove panel ── */}
        {removePanelOpen && (
          <>
            <div className="fixed inset-0 z-40 backdrop-blur-sm" onClick={() => setRemovePanelOpen(false)} />
            <div className="fixed top-0 right-0 z-50 h-screen w-full max-w-sm bg-transparent border-l border-border rounded-l-3xl backdrop-blur-lg shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <div>
                  <h2 className="text-lg font-semibold">Remove Accounts</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Click an account to remove it</p>
                </div>
                <button onClick={() => setRemovePanelOpen(false)}
                  className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex-shrink-0">
                <p className="text-sm text-red-400 font-medium">⚠ This action is irreversible</p>
                <p className="text-xs text-red-400/70 mt-0.5">All synced emails will be deleted.</p>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {accounts.map(account => (
                  <button key={account.id} onClick={() => handleRemoveAccount(account.id)}
                    className="w-full flex items-center justify-between px-4 py-3 glass rounded-xl group text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold">{account.email_address[0].toUpperCase()}</span>
                      </div>
                      <span className="text-sm truncate">{account.email_address}</span>
                    </div>
                    <span className="text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2">Remove</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── IMAP Connect Modal ── */}
      {showImapForm && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md glass rounded-3xl overflow-hidden">

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h2 className="font-semibold">Connect Email Account</h2>
                <button onClick={() => setShowImapForm(false)} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">

                {/* Provider selector */}
                <div>
                  <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Provider</label>
                  <div className="flex gap-2">
                    {(['yahoo', 'outlook', 'imap'] as const).map(p => (
                      <button key={p}
                        onClick={() => handleProviderChange(p)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                          imapForm.provider === p
                            ? 'glass-black text-white'
                            : 'text-white/50 hover:text-white border border-white/10 hover:border-white/20'
                        }`}>
                        {p === 'imap' ? 'Custom' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Yahoo / Outlook app-password notice */}
                {(imapForm.provider === 'yahoo' || imapForm.provider === 'outlook') && (
                  <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    {imapForm.provider === 'yahoo'
                      ? '⚠ Yahoo requires an App Password. Go to Yahoo → Security → Generate app password.'
                      : '⚠ Outlook requires an App Password if you have 2FA enabled. Check Microsoft Account Security settings.'}
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-xs text-white/50 uppercase tracking-wider mb-1">Email address</label>
                  <input type="email" value={imapForm.email}
                    onChange={e => setImapForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@yahoo.com"
                    className="w-full bg-white/08 text-black text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/25" />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs text-white/50 uppercase tracking-wider mb-1">
                    {imapForm.provider === 'imap' ? 'Password' : 'App Password'}
                  </label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={imapForm.password}
                      onChange={e => setImapForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••••••"
                      className="w-full bg-white/08 text-black text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/25" />
                    <button type="button" onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Custom domain server fields */}
                {imapForm.provider === 'imap' && (
                  <div className="space-y-3 pt-1">
                    <div className="text-xs text-white/40 uppercase tracking-wider">Server settings</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-xs text-white/40 mb-1">IMAP host</label>
                        <input type="text" value={imapForm.imap_host}
                          onChange={e => setImapForm(f => ({ ...f, imap_host: e.target.value }))}
                          placeholder="imap.example.com"
                          className="w-full bg-white/08 text-black text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/25" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Port</label>
                        <input type="number" value={imapForm.imap_port}
                          onChange={e => setImapForm(f => ({ ...f, imap_port: +e.target.value }))}
                          className="w-full bg-white/08 text-black text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white/30" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-xs text-white/40 mb-1">SMTP host</label>
                        <input type="text" value={imapForm.smtp_host}
                          onChange={e => setImapForm(f => ({ ...f, smtp_host: e.target.value }))}
                          placeholder="smtp.example.com"
                          className="w-full bg-white/08 text-black text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/25" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Port</label>
                        <input type="number" value={imapForm.smtp_port}
                          onChange={e => setImapForm(f => ({ ...f, smtp_port: +e.target.value }))}
                          className="w-full bg-white/08 text-black text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white/30" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Connect button */}
                <button onClick={handleConnectImap} disabled={imapConnecting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm glass-black hover:opacity-90 disabled:opacity-50 transition-all mt-2">
                  {imapConnecting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Testing connection…</>
                    : 'Connect Account'}
                </button>

              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}