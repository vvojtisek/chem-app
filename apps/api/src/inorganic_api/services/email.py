"""SMTP delivery of short-lived account links."""

import base64
import hashlib
import hmac
import smtplib
from email.message import EmailMessage
from urllib.parse import quote

from cryptography.fernet import Fernet

from inorganic_api.config import Settings
from inorganic_api.errors import AppError


def require_delivery_config(settings: Settings) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        raise AppError(503, "email_unavailable", "Email delivery is temporarily unavailable.")


def _cipher(settings: Settings) -> Fernet:
    key = hmac.new(
        settings.secret_key.encode("utf-8"), b"inorganic-mail-outbox-v1", hashlib.sha256
    ).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_token(settings: Settings, token: str) -> str:
    return _cipher(settings).encrypt(token.encode("ascii")).decode("ascii")


def decrypt_token(settings: Settings, encrypted_token: str) -> str:
    return _cipher(settings).decrypt(encrypted_token.encode("ascii")).decode("ascii")


def send_account_link(settings: Settings, recipient: str, token: str, purpose: str) -> None:
    require_delivery_config(settings)
    if purpose == "verify":
        path = "/verify-email"
        subject = "Potvrzení e-mailu – Anorganická chemie"
        description = "Potvrďte svoji e-mailovou adresu"
    else:
        path = "/reset-password"
        subject = "Obnovení hesla – Anorganická chemie"
        description = "Nastavte si nové heslo"
    url = f"{str(settings.public_origin).rstrip('/')}{path}?token={quote(token)}"
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(f"{description}: {url}\n\nOdkaz má omezenou platnost.\n")
    try:
        with smtplib.SMTP(
            settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout
        ) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise AppError(
            503, "email_unavailable", "Email delivery is temporarily unavailable."
        ) from exc
