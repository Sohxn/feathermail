import { useState, useEffect, useRef } from "react";
import { X, Minus, Maximize2, Send, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as api from "@/services/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";

export interface ComposeInitData {
  to?: string;
  subject?: string;
  body?: string;
}

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initData?: ComposeInitData;
}

export function ComposeModal({ isOpen, onClose, initData }: ComposeModalProps) {
  const { theme } = useTheme();
  const isNeo = theme === "neo";
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const toRef   = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTo(initData?.to ?? "");
      setSubject(initData?.subject ?? "");
      setBody(initData?.body ?? "");
      setError(null);
      setIsMinimized(false);
      setSending(false);
      setTimeout(() => {
        if (initData?.to) bodyRef.current?.focus();
        else toRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initData]);

  const reset = () => { setTo(""); setSubject(""); setBody(""); setError(null); setSending(false); };
  const handleClose = () => { reset(); onClose(); };

  const validate = (): string | null => {
    if (!to.trim()) return "Recipient address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) return "Enter a valid email address.";
    if (!subject.trim()) return "Subject cannot be empty.";
    if (!body.trim()) return "Message body cannot be empty.";
    return null;
  };

  const handleSend = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    try {
      setSending(true);
      setError(null);
      await api.sendEmail(to.trim(), subject.trim(), body.trim());
      toast.success("Email sent!");
      handleClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  /* Shared input style — transparent bg, white text, no border, monospace */
  const inputCls = "w-full bg-transparent text-white text-sm focus:outline-none placeholder:text-white/30";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── MOBILE: full-screen overlay ── */}
          <motion.div
            key="mobile-compose"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="md:hidden fixed inset-0 z-50 flex flex-col"
            style={{ background: isNeo ? "#0b0b0b" : "rgba(10,10,10,0.92)", backdropFilter: isNeo ? "none" : "blur(24px)" }}
            onKeyDown={handleKeyDown}
          >
            <div className={cn("flex items-center justify-between px-4 py-3 flex-shrink-0 border-b", isNeo ? "border-border" : "border-white/10")}>
              <button onClick={handleClose} className={cn("p-1 rounded transition-colors", isNeo ? "text-muted-foreground hover:text-foreground hover:bg-secondary" : "text-white/50 hover:text-white")}>
                <X className="w-5 h-5" />
              </button>
              <span className={isNeo ? "text-sm font-medium text-foreground" : "text-sm font-medium text-white"}>{initData?.to ? "Reply" : "New Message"}</span>
              <button
                onClick={handleSend}
                disabled={sending}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60",
                  isNeo ? "bg-primary text-primary-foreground" : "glass"
                )}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
            <div className="flex flex-col flex-1 min-h-0 px-4 pt-2">
              <div className={cn("flex items-center py-3 border-b", isNeo ? "border-border" : "border-white/10")}>
                <label className={cn("text-sm w-16 shrink-0", isNeo ? "text-muted-foreground" : "text-white/40")}>To</label>
                <input ref={toRef} type="email" value={to}
                  onChange={e => { setTo(e.target.value); setError(null); }}
                  className={inputCls} placeholder="recipient@example.com" disabled={sending} />
              </div>
              <div className={cn("flex items-center py-3 border-b", isNeo ? "border-border" : "border-white/10")}>
                <label className={cn("text-sm w-16 shrink-0", isNeo ? "text-muted-foreground" : "text-white/40")}>Subject</label>
                <input type="text" value={subject}
                  onChange={e => { setSubject(e.target.value); setError(null); }}
                  className={inputCls} placeholder="Subject" disabled={sending} />
              </div>
              <textarea ref={bodyRef} value={body}
                onChange={e => { setBody(e.target.value); setError(null); }}
                className={`${inputCls} flex-1 resize-none pt-3 pb-2`}
                placeholder="Compose your message…" disabled={sending} />
              {error && (
                <div className="flex items-center gap-2 pb-2 text-xs text-red-400 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /><span>{error}</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── DESKTOP: floating card (bottom-right) ── */}
          <motion.div
            key="desktop-compose"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: isMinimized ? "calc(100vh - 48px)" : 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="hidden md:flex md:flex-col fixed bottom-4 right-4 w-[520px] h-[480px] rounded-2xl z-50 overflow-hidden"
            style={{
              background: "rgba(12, 12, 12, 0.82)",
              backdropFilter: "blur(28px) saturate(150%) brightness(0.9)",
              WebkitBackdropFilter: "blur(28px) saturate(150%) brightness(0.9)",
              boxShadow: `
                inset 0  1px 0 rgba(255,255,255,0.18),
                inset 0 -1px 0 rgba(255,255,255,0.04),
                0 0 0 0.5px rgba(255,255,255,0.14),
                0 24px 60px rgba(0,0,0,0.60),
                0  8px 20px rgba(0,0,0,0.40)
              `
            }}
            onKeyDown={handleKeyDown}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span className={isNeo ? "text-sm font-medium text-foreground" : "text-sm font-medium text-white"}>
                {initData?.to ? "Reply" : "New Message"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(m => !m)}
                  className="p-1.5 rounded-md transition-colors text-white/40 hover:text-white hover:bg-white/08"
                  title={isMinimized ? "Restore" : "Minimise"}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-md transition-colors text-white/40 hover:text-white hover:bg-white/08" title="Expand">
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button onClick={handleClose} className="p-1.5 rounded-md transition-colors text-white/40 hover:text-white hover:bg-white/08" title="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <div className="flex flex-col flex-1 min-h-0 px-5 pt-4">
                {/* To */}
                <div className="flex items-center py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <label className="text-xs text-white/35 w-16 shrink-0 uppercase tracking-wider">To</label>
                  <input ref={toRef} type="email" value={to}
                    onChange={e => { setTo(e.target.value); setError(null); }}
                    className={inputCls} placeholder="recipient@example.com" disabled={sending} />
                </div>

                {/* Subject */}
                <div className="flex items-center py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <label className="text-xs text-white/35 w-16 shrink-0 uppercase tracking-wider">Subject</label>
                  <input type="text" value={subject}
                    onChange={e => { setSubject(e.target.value); setError(null); }}
                    className={inputCls} placeholder="Subject" disabled={sending} />
                </div>

                {/* Body */}
                <textarea ref={bodyRef} value={body}
                  onChange={e => { setBody(e.target.value); setError(null); }}
                  className={`${inputCls} flex-1 resize-none py-4 leading-relaxed`}
                  placeholder="Compose your message… (Ctrl+Enter to send)"
                  disabled={sending} />

                {error && (
                  <div className="flex items-center gap-2 pb-2 text-xs text-red-400 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /><span>{error}</span>
                  </div>
                )}

                {/* Footer */}
                <div className={cn("flex items-center justify-between py-3 flex-shrink-0 border-t", isNeo ? "border-border" : "border-white/10")}>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: isNeo ? "#f1b86b" : "rgba(255,255,255,0.12)",
                      color: isNeo ? "#050505" : undefined,
                      boxShadow: isNeo ? "0 0 0 1px #2a2a2a" : "inset 0 1px 0 rgba(255,255,255,0.20), 0 0 0 0.5px rgba(255,255,255,0.12)"
                    }}
                  >
                    {sending
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                      : <><Send className="w-4 h-4" />Send</>}
                  </button>
                  <button
                    onClick={handleClose}
                    disabled={sending}
                    className={cn("px-3 py-2 text-sm transition-colors disabled:opacity-50", isNeo ? "text-muted-foreground hover:text-foreground" : "text-white/35 hover:text-white/70")}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}