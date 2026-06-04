import { format } from "date-fns";
import { useEmailStore } from "@/store/emailStore";
import * as api from "@/services/apiClient";
import { Star, Archive, Trash2, Reply, Sparkles } from "lucide-react";
import { useEffect, useRef, useCallback, useState } from "react";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { ComposeInitData } from "./ComposeModal";
import { useTheme } from "@/components/theme/ThemeProvider";

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
 */
function getSanitizedHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "div",
      "span",
      "section",
      "article",
      "header",
      "footer",
      "main",
      "img",
      "figure",
      "figcaption",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "colgroup",
      "col",
      "hr",
      "pre",
      "code",
      "center",
      "font",
      "html",
      "head",
      "body",
      "meta",
      "title",
      "style",
    ],
    ALLOWED_ATTR: [
      "style",
      "class",
      "id",
      "href",
      "src",
      "srcset",
      "alt",
      "title",
      "loading",
      "width",
      "height",
      "border",
      "cellpadding",
      "cellspacing",
      "align",
      "valign",
      "bgcolor",
      "background",
      "color",
      "face",
      "size",
      "target",
      "rel",
      "role",
      "aria-label",
      "aria-hidden",
    ],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea"],
    FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover", "onfocus", "onblur", "onchange"],
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
  });
}

/**
 * IframeEmailBody
 * Renders the sanitised HTML inside a sandboxed iframe so the email's
 * own CSS can't bleed into our app UI.
 *
 * IMPORTANT CHANGE: we no longer auto-resize the iframe to its content.
 * The iframe simply fills the parent panel, and scrollbars live either
 * in the iframe or the outer panel, but the overall layout height stays fixed.
 */
function IframeEmailBody({
  html,
  onDarkDetected,
}: {
  html: string;
  onDarkDetected?: (isDark: boolean) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const writeContent = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const sanitized = getSanitizedHTML(html);

    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            html, body {
              margin: 0;
              padding: 0;
              font-family: var(--font-family-base, "Roboto", sans-serif);
              font-weight: var(--font-weight-base, 400);
              font-size: 14px;
              line-height: 1.5;
              color: #1a1a1a;
              background: transparent;
              word-break: break-word;
              overflow-x: hidden;
            }

            img {
              max-width: 100% !important;
              height: auto !important;
              display: inline-block;
            }

            img[width], img[height] {
              max-width: 100% !important;
              height: auto !important;
            }

            table {
              border-collapse: collapse;
              max-width: 100%;
            }

            a {
              color: #1a73e8;
            }

            blockquote {
              margin: 8px 0 8px 16px;
              padding-left: 12px;
              border-left: 3px solid #d1d5db;
              color: #6b7280;
            }

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

    // Keep the dark/light detection — it doesn't affect layout.
    requestAnimationFrame(() => {
      try {
        const textNodes = doc.body.querySelectorAll(
          "p, div, span, td, li, h1, h2, h3, h4, h5, h6",
        );
        let darkCount = 0;
        let lightCount = 0;

        const toCheck = Array.from(textNodes).slice(0, 20);
        const view = doc.defaultView;

        for (const el of toCheck) {
          if (!view) break;
          const color = view.getComputedStyle(el).color;
          const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
          if (!match) continue;
          const r = parseInt(match[1], 10);
          const g = parseInt(match[2], 10);
          const b = parseInt(match[3], 10);
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness > 128) {
            lightCount += 1;
          } else {
            darkCount += 1;
          }
        }

        onDarkDetected?.(lightCount > darkCount);
      } catch {
        // ignore
      }
    });
  }, [html, onDarkDetected]);

  useEffect(() => {
    writeContent();
  }, [writeContent]);

  return (
    <iframe
      ref={iframeRef}
      title="Email body"
      sandbox="allow-same-origin"
      className="w-full h-full border-0 block"
      style={{ minHeight: "200px" }}
      aria-label="Email content"
    />
  );
}

/**
 * Plain-text body renderer.
 */
function PlainTextBody({ text }: { text: string }) {
  const linked = text.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#1a73e8">$1</a>',
  );

  return (
    <div
      className="whitespace-pre-wrap text-sm leading-relaxed text-foreground font-mono"
      style={{ wordBreak: "break-word" }}
      dangerouslySetInnerHTML={{ __html: linked }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Main EmailView component
// ─────────────────────────────────────────────────────────────

export default function EmailView({ email, onReply }: EmailViewProps) {
  const { theme } = useTheme();
  const isNeo = theme === "neo";
  const markAsRead = useEmailStore((state) => state.markEmailAsRead);
  const toggleStar = useEmailStore((state) => state.toggleEmailStar);
  const archiveEmail = useEmailStore((state) => state.archiveEmail);
  const [emailWantsDarkBg, setEmailWantsDarkBg] = useState<boolean | null>(null);

  useEffect(() => {
    if (!email.is_read) {
      markAsRead(email.id);
      api.markEmailAsRead(email.id).catch((err) =>
        console.error("Failed to mark as read:", err),
      );
    }
  }, [email.id, email.is_read, markAsRead]);

  useEffect(() => {
    setEmailWantsDarkBg(null);
  }, [email.id]);

  const handleToggleStar = async () => {
    try {
      toggleStar(email.id);
      await api.toggleEmailStar(email.id, email.is_starred);
    } catch {
      toast.error("Failed to update email");
      toggleStar(email.id);
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
    const quotedHeader = `\n\n---\nOn ${dateStr}, ${
      email.from_name ?? email.from_email
    } <${email.from_email}> wrote:\n`;
    const originalBody =
      email.body_text || email.body_html?.replace(/<[^>]+>/g, "") || "";
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
    <div className="flex flex-col h-full p-2 md:p-4 gap-3 overflow-hidden">
      {/* Header card */}
      <div className="rounded-2xl p-4 md:p-6 bg-card">
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

      {/* AI Summary placeholder */}
      <div className="rounded-2xl shadow-xl p-4 flex items-center justify-center gap-2 min-h-[56px] bg-card">
        <span className="font-semibold text-sm">AI SUMMARY</span>
        <Sparkles className="w-4 h-4" />
      </div>

      {/* Email body panel — this is now the scroll area */}
      <div
        className="
          bg-card rounded-2xl shadow-xl
          p-4 md:p-6
          flex-1 min-h-0
          overflow-x-hidden overflow-y-auto
          transition-colors duration-300
        "
      >
        {email.body_html ? (
          <IframeEmailBody
            html={email.body_html}
            onDarkDetected={setEmailWantsDarkBg}
          />
        ) : (
          <PlainTextBody text={email.body_text} />
        )}
      </div>

      {/* Reply button */}
      {onReply && (
        <div className="pt-2 pb-4">
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