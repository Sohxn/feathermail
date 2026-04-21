import imaplib
import email as email_parser
import smtplib
import ssl
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import parsedate_to_datetime, parseaddr
from email.header import decode_header


def _decode_str(value: str | bytes | None) -> str:
    if value is None:
        return ""
    parts = decode_header(value)
    decoded = []
    for fragment, charset in parts:
        if isinstance(fragment, bytes):
            decoded.append(fragment.decode(charset or "utf-8", errors="ignore"))
        else:
            decoded.append(fragment)
    return "".join(decoded)


def _extract_email_address(header: str) -> str:
    _, addr = parseaddr(header)
    return addr.strip()


def _extract_name(header: str) -> str:
    name, _ = parseaddr(header)
    return _decode_str(name).strip().strip('"')


class ImapService:

    # ── Connection ────────────────────────────────────────────

    def connect(self, host: str, port: int, username: str, password: str) -> imaplib.IMAP4_SSL:
        # ssl
        context = ssl.create_default_context()
        mail = imaplib.IMAP4_SSL(host, port, ssl_context=context)
        mail.login(username, password)
        return mail

    def test_connection(self, host: str, port: int, username: str, password: str) -> tuple[bool, str]:
        try:
            mail = self.connect(host, port, username, password)
            mail.logout()
            return True, ""
        except imaplib.IMAP4.error as e:
            return False, f"Authentication failed: {e}"
        except Exception as e:
            return False, str(e)

    
    def fetch_emails(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        max_results: int = 50,
    ) -> dict:
    #    fetch most recent max results
        mail = self.connect(host, port, username, password)
        try:
            mail.select("INBOX")

            # Search for ALL messages — returns a space-separated list of IDs
            status, data = mail.search(None, "ALL")
            if status != "OK":
                return {"emails": [], "history_id": None, "is_full_sync": True}

            # data[0] is bytes like b"1 2 3 4 5"
            all_ids = data[0].split()

            # Take only the last `max_results` (most recent)
            # IMAP IDs are ascending, so the highest IDs are newest
            ids_to_fetch = all_ids[-max_results:]

            emails = []
            for msg_id in reversed(ids_to_fetch):   # newest first
                parsed = self._fetch_and_parse(mail, msg_id)
                if parsed:
                    emails.append(parsed)

            return {"emails": emails, "history_id": None, "is_full_sync": True}

        finally:
            try:
                # after fetching
                mail.logout()
            except Exception:
                pass



    def send_email(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        to: str,
        subject: str,
        body: str,
    ) -> dict:
        """Send a plain-text email via SMTP over SSL."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = username
        msg["To"] = to
        msg.attach(MIMEText(body, "plain", "utf-8"))

        context = ssl.create_default_context()
        try:
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                server.login(username, password)
                server.sendmail(username, [to], msg.as_bytes())
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── Internal helpers ──────────────────────────────────────

    def _fetch_and_parse(self, mail: imaplib.IMAP4_SSL, msg_id: bytes) -> dict | None:
        """Fetch a single message by its IMAP sequence number and parse it."""
        try:
            # RFC822 = the full raw email
            status, data = mail.fetch(msg_id, "(RFC822 FLAGS)")
            if status != "OK" or not data or data[0] is None:
                return None

            raw_email = data[0][1]          # bytes
            flags_str = str(data[0][0])     # e.g. b"1 (FLAGS (\\Seen) RFC822 {3210}"

            is_read    = "\\Seen"    in flags_str
            is_starred = "\\Flagged" in flags_str

            return self._parse_email(raw_email, msg_id.decode(), is_read, is_starred)

        except Exception as e:
            print(f"Error fetching message {msg_id}: {e}", flush=True)
            return None

    def _parse_email(
        self,
        raw_bytes: bytes,
        imap_id: str,
        is_read: bool,
        is_starred: bool,
    ) -> dict | None:
        """
        Parse raw RFC822 bytes into the same dict shape that
        GmailService._get_email_details() returns so the rest of
        the codebase (save_emails_batch etc.) works unchanged.
        """
        try:
            msg = email_parser.message_from_bytes(raw_bytes)

            subject   = _decode_str(msg.get("Subject", "(No Subject)"))
            from_raw  = _decode_str(msg.get("From", ""))
            to_raw    = _decode_str(msg.get("To", ""))
            date_raw  = msg.get("Date", "")
            msg_id_header = msg.get("Message-ID", imap_id)

            from_email = _extract_email_address(from_raw)
            from_name  = _extract_name(from_raw)

            # Parse To as a list (some emails have multiple recipients)
            to_emails = [
                _extract_email_address(addr.strip())
                for addr in to_raw.split(",")
                if addr.strip()
            ]

            # Parse date
            try:
                received_at = parsedate_to_datetime(date_raw).isoformat()
            except Exception:
                from datetime import datetime, timezone
                received_at = datetime.now(timezone.utc).isoformat()

            body_text, body_html = self._extract_body(msg)

            # Snippet = first 200 chars of plain text, whitespace collapsed
            snippet = " ".join(body_text.split())[:200] if body_text else ""

            # Build a stable unique ID from the Message-ID header
            # (strip angle brackets if present)
            stable_id = re.sub(r"[<>\s]", "", msg_id_header) or f"imap-{imap_id}"

            return {
                "gmail_id":   stable_id,          # reuse this column for IMAP too
                "thread_id":  stable_id,           # IMAP has no threads; use same ID
                "subject":    subject or "(No Subject)",
                "from_email": from_email,
                "from_name":  from_name or None,
                "to_email":   to_emails,
                "cc_email":   [],
                "received_at": received_at,
                "body_text":  body_text,
                "body_html":  body_html,
                "snippet":    snippet,
                "labels":     ["INBOX"],
                "is_read":    is_read,
                "is_starred": is_starred,
            }

        except Exception as e:
            print(f"Error parsing email: {e}", flush=True)
            return None

    def _extract_body(self, msg) -> tuple[str, str]:
        """
        Walk the MIME tree and extract plain-text and HTML bodies.
        Handles both multipart and single-part messages.
        """
        body_text = ""
        body_html = ""

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                # Skip attachments
                disposition = str(part.get("Content-Disposition", ""))
                if "attachment" in disposition:
                    continue

                payload = part.get_payload(decode=True)
                if payload is None:
                    continue

                charset = part.get_content_charset() or "utf-8"
                decoded = payload.decode(charset, errors="ignore")

                if content_type == "text/plain" and not body_text:
                    body_text = decoded
                elif content_type == "text/html" and not body_html:
                    body_html = decoded
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                decoded = payload.decode(charset, errors="ignore")
                if msg.get_content_type() == "text/html":
                    body_html = decoded
                else:
                    body_text = decoded

        # Fallback: if we only have HTML, strip tags for the text version
        if not body_text and body_html:
            body_text = re.sub(r"<[^>]+>", " ", body_html)
            body_text = re.sub(r"\s+", " ", body_text).strip()

        return body_text, body_html