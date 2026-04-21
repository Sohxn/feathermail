import { format } from "date-fns";
import { useEmailStore } from "@/store/emailStore";
import * as api from "@/services/apiClient";
import { Star, Archive, Trash2, Reply, Sparkles } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { ComposeInitData } from "./ComposeModal";

interface EmailViewProps {
  email: {
    id: string;
    subject: string;
    from_name: string | null;
    from_email: string;
    to_email: string[];
    received_at: string;
    body_text: string;
    body_html: string | null;
    is_read: boolean;
    is_starred: boolean;
  };
  onReply?: (data: ComposeInitData) => void;
}

/**
 * Sanitise HTML while KEEPING inline styles and safe attributes.
 * We allow style so the email renders as the sender intended —
 * exactly what Gmail / Outlook / Apple Mail do.
 * Scripts, iframes, and event handlers are still stripped.
 */
function getSanitizedHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
      "a", "ul", "ol", "li", "blockquote",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "div", "span", "section", "article", "header", "footer", "main",
      "img", "figure", "figcaption",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "colgroup", "col",
      "hr", "pre", "code", "center", "font",
      // Layout helpers used by email builders
      "html", "head", "body", "meta", "title", "style",
    ],
    ALLOWED_ATTR: [
      // Presentation
      "style", "class", "id",
      // Links / images
      "href", "src", "srcset", "alt", "title", "loading",
      // Table layout (used by almost every marketing email)
      "width", "height", "border", "cellpadding", "cellspacing",
      "align", "valign", "bgcolor", "background",
      // Typography (legacy <font> tag)
      "color", "face", "size",
      // Misc
      "target", "rel", "role", "aria-label", "aria-hidden",
    ],
    // Strip these completely — they're dangerous
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea"],
    FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover", "onfocus", "onblur", "onchange"],
    // Keep the document structure when it's a full HTML email
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
  });
}

/**
 * IframeEmailBody
 * Renders the sanitised HTML inside a sandboxed iframe so the email's
 * own CSS can't bleed into our app UI — the same technique used by
 * Gmail, Outlook Web, Fastmail, and Hey.
 */
function IframeEmailBody({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const writeContent = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const sanitized = getSanitizedHTML(html);

    // Inject a minimal reset so images and tables behave sensibly,
    // but don't fight the email's own inline styles.
    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            /* ── Minimal host reset ── */
            html, body {
              margin: 0;
              padding: 0;
              /* Let email's own font / color win; fall back to system stack */
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                           Helvetica, Arial, sans-serif;
              font-size: 14px;
              line-height: 1.5;
              color: #1a1a1a;
              background: transparent;
              word-break: break-word;
              overflow-x: hidden;
            }

            /* Images: never overflow the container, keep aspect ratio */
            img {
              max-width: 100% !important;
              height: auto !important;
              display: inline-block;
            }

            /* Block-level images (logos, banners) */
            img[width], img[height] {
              /* Honor explicit dimensions up to the iframe width */
              max-width: 100% !important;
              height: auto !important;
            }

            /* Table-based email layouts — let them size naturally */
            table {
              border-collapse: collapse;
              /* Don't force 100% width — many emails use fixed-width tables */
              max-width: 100%;
            }

            /* Links — keep sender's colour if set via inline style, otherwise blue */
            a {
              color: #1a73e8;
            }

            /* Quoted reply blocks */
            blockquote {
              margin: 8px 0 8px 16px;
              padding-left: 12px;
              border-left: 3px solid #d1d5db;
              color: #6b7280;
            }

            /* Prevent the email from stretching the iframe horizontally */
            body > * {
              max-width: 100%;
              overflow-x: hidden;
            }
          </style>
        </head>
        <body>${sanitized}</body>
      </html>
    `;

    doc.open();
    doc.write(wrappedHtml);
    doc.close();

    // Auto-resize the iframe to fit its content so we don't show a
    // double scrollbar — the outer container scrolls instead.
    const resize = () => {
      try {
        const body = doc.body;
        const html = doc.documentElement;
        const height = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.scrollHeight,
          html.offsetHeight,
        );
        iframe.style.height = `${height + 16}px`;
      } catch {
        // cross-origin guard (shouldn't happen with srcdoc, but be safe)
      }
    };

    // Resize after paint and again after images load
    requestAnimationFrame(resize);
    doc.addEventListener("load", resize, true); // captures image load events
    setTimeout(resize, 500);  // safety net for slow images
    setTimeout(resize, 1500);
  }, [html]);

  useEffect(() => {
    writeContent();
  }, [writeContent]);

  return (
    <iframe
      ref={iframeRef}
      title="Email body"
      // sandbox allows same-origin so our JS can resize it, but blocks
      // navigation, popups, forms, and script execution from the email.
      sandbox="allow-same-origin"
      className="w-full border-0 block"
      style={{ minHeight: "200px" }}
      // Accessibility
      aria-label="Email content"
    />
  );
}

/**
 * Plain-text body renderer.
 * Converts URLs to clickable links and preserves whitespace.
 */
function PlainTextBody({ text }: { text: string }) {
  // Very simple URL linkifier
  const linked = text.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#1a73e8">$1</a>',
  );

  return (
    <div
      className="whitespace-pre-wrap text-sm leading-relaxed text-foreground font-mono"
      style={{ wordBreak: "break-word" }}
      // Safe: we only inject anchor tags around URLs we already extracted
      dangerouslySetInnerHTML={{ __html: linked }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Main EmailView component
// ─────────────────────────────────────────────────────────────

export default function EmailView({ email, onReply }: EmailViewProps) {
  const markAsRead   = useEmailStore((state) => state.markEmailAsRead);
  const toggleStar   = useEmailStore((state) => state.toggleEmailStar);
  const archiveEmail = useEmailStore((state) => state.archiveEmail);

  useEffect(() => {
    if (!email.is_read) {
      markAsRead(email.id);
      api.markEmailAsRead(email.id).catch((err) =>
        console.error("Failed to mark as read:", err),
      );
    }
  }, [email.id, email.is_read, markAsRead]);

  const handleToggleStar = async () => {
    try {
      toggleStar(email.id);
      await api.toggleEmailStar(email.id, email.is_starred);
    } catch {
      toast.error("Failed to update email");
      toggleStar(email.id); // rollback
    }
  };

  const handleArchive = async () => {
    try {
      archiveEmail(email.id);
      await api.archiveEmail(email.id);
      toast.success("Email archived");
    } catch {
      toast.error("Failed to archive email");
    }
  };

  const handleReply = () => {
    if (!onReply) return;
    const dateStr = format(new Date(email.received_at), "PPpp");
    const quotedHeader = `\n\n---\nOn ${dateStr}, ${email.from_name ?? email.from_email} <${email.from_email}> wrote:\n`;
    const originalBody =
      email.body_text ||
      email.body_html?.replace(/<[^>]+>/g, "") ||
      "";
    const quoted = originalBody
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
    const reSubject = email.subject.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject}`;
    onReply({ to: email.from_email, subject: reSubject, body: quotedHeader + quoted });
  };

  return (
    <div className="flex flex-col p-2 md:p-4 gap-3">

      {/* ── Header card ── */}
      <div className="rounded-2xl p-4 md:p-6 glass">
        <div className="flex items-start justify-between mb-4 gap-2">
          <h1 className="text-lg md:text-2xl font-bold flex-1 text-foreground break-words">
            {email.subject || "(No Subject)"}
          </h1>
          <div className="flex gap-1 flex-shrink-0">
            {onReply && (
              <button
                onClick={handleReply}
                className="p-2 hover:bg-secondary rounded-md transition-colors"
                title="Reply"
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleToggleStar}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
            >
              <Star
                className={`w-4 h-4 ${
                  email.is_starred ? "fill-yellow-500 text-yellow-500" : ""
                }`}
              />
            </button>
            <button
              onClick={handleArchive}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1 text-sm text-foreground">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-semibold">From:</span>
            <span>{email.from_name || email.from_email}</span>
            <span className="text-muted-foreground break-all">
              &lt;{email.from_email}&gt;
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-semibold">To:</span>
            <span className="break-all">{email.to_email.join(", ")}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold">Date:</span>
            <span>{format(new Date(email.received_at), "PPpp")}</span>
          </div>
        </div>
      </div>

      {/* ── AI Summary placeholder ── */}
      <div className="rounded-2xl shadow-xl p-4 flex items-center justify-center gap-2 min-h-[56px] glass">
        <span className="font-semibold text-sm">AI SUMMARY</span>
        <Sparkles className="w-4 h-4" />
      </div>

      {/* ── Email body ── */}
      <div className="glass-black rounded-2xl shadow-xl p-4 md:p-6 overflow-x-hidden">
        {email.body_html ? (
          <IframeEmailBody html={email.body_html} />
        ) : (
          <PlainTextBody text={email.body_text} />
        )}
      </div>

      {/* ── Reply button ── */}
      {onReply && (
        <div className="pb-4">
          <button
            onClick={handleReply}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-xl hover:glass transition-colors text-muted-foreground hover:text-foreground"
          >
            <Reply className="w-4 h-4" />
            Reply to {email.from_name ?? email.from_email}
          </button>
        </div>
      )}
    </div>
  );
}