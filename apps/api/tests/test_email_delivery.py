import ssl
from email.message import EmailMessage

import pytest

from inorganic_api.config import Settings
from inorganic_api.services import email


class RecordingSmtp:
    instances: list["RecordingSmtp"] = []

    def __init__(self, host: str, port: int, timeout: int) -> None:
        self.starttls_context: ssl.SSLContext | None = None
        self.calls: list[str] = []
        RecordingSmtp.instances.append(self)

    def __enter__(self) -> "RecordingSmtp":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def starttls(self, *, context: ssl.SSLContext | None = None) -> None:
        self.calls.append("starttls")
        self.starttls_context = context

    def login(self, username: str, password: str) -> None:
        self.calls.append("login")

    def send_message(self, message: EmailMessage) -> None:
        self.calls.append("send")
        self.message = message


def test_starttls_verifies_server_certificate_before_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    RecordingSmtp.instances.clear()
    monkeypatch.setattr(email.smtplib, "SMTP", RecordingSmtp)
    settings = Settings(
        smtp_host="mail.example.test",
        smtp_from="noreply@example.test",
        smtp_starttls=True,
        smtp_username="relay-user",
        smtp_password="relay-password",
    )

    email.send_account_link(settings, "student@example.test", "token-value", "reset")

    (smtp,) = RecordingSmtp.instances
    assert smtp.starttls_context is not None
    assert smtp.starttls_context.verify_mode == ssl.CERT_REQUIRED
    assert smtp.starttls_context.check_hostname is True
    assert smtp.calls == ["starttls", "login", "send"]


@pytest.mark.parametrize(
    ("purpose", "subject", "wording"),
    [
        ("invite", "Pozvánka – Anorganická chemie", "Správce vám vytvořil účet"),
        ("reset", "Obnovení hesla – Anorganická chemie", "Nastavte si nové heslo"),
    ],
)
def test_account_links_open_the_password_form(
    monkeypatch: pytest.MonkeyPatch, purpose: str, subject: str, wording: str
) -> None:
    RecordingSmtp.instances.clear()
    monkeypatch.setattr(email.smtplib, "SMTP", RecordingSmtp)
    settings = Settings(public_origin="https://chem.example.test")

    email.send_account_link(settings, "student@example.test", "token-value", purpose)

    (smtp,) = RecordingSmtp.instances
    assert smtp.message["Subject"] == subject
    body = smtp.message.get_content()
    assert wording in body
    assert "https://chem.example.test/reset-password?token=token-value" in body
