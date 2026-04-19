import imaplib
import email as email_parser
import smtplib
from email.mime.text import MIMEText
import ssl
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.utils import parsedate_to_datetime, parseaddr
from email.header import decode_header


# helper functions
def _decode_str(value: str | bytes | None) -> str:
    """
    Decode an encoded email header value like
    =?utf-8?b?SGVsbG8=?= into a plain string.
    Works on both str and bytes inputs.
    """
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
    """Pull the bare email address out of 'Name <addr>' format."""
    _, addr = parseaddr(header)
    return addr.strip()
 
 
def _extract_name(header: str) -> str:
    """Pull the display name out of 'Name <addr>' format."""
    name, _ = parseaddr(header)
    return _decode_str(name).strip().strip('"')





# main IMAP class
class ImapService:

    #connect to service
    def connect(self, host, port, username, password):
        context = ssl.create_default_context()
        mail = imaplib.IMAP4_SSL(host, port, ssl_context=context)
        mail.login(username, password)
        return mail

    #using connect() in test_connection()
    def test_connection(self, host, port, username, password):
        try:
            mail = self.connect(username, password)
            mail.logout()
            return true
        except Exception as e:
            return False, str(e)

    
    def fetch_emails(self, host, port, username, password, max_emails=50):
        mail.select('INBOX')
