"""Persistence operations for queued account email."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from inorganic_api.models import EmailVerificationToken, MailOutbox, PasswordResetToken, User

LEASE = timedelta(seconds=60)


@dataclass(frozen=True)
class ClaimedMail:
    id: UUID
    recipient: str
    encrypted_token: str
    purpose: str


def enqueue_verification(
    db: Session, recipient: str, encrypted_token: str, token: EmailVerificationToken
) -> None:
    db.add(
        MailOutbox(
            recipient=recipient,
            encrypted_token=encrypted_token,
            verification_token_id=token.id,
        )
    )


def enqueue_reset(
    db: Session, recipient: str, encrypted_token: str, token: PasswordResetToken
) -> None:
    db.add(
        MailOutbox(
            recipient=recipient,
            encrypted_token=encrypted_token,
            reset_token_id=token.id,
        )
    )


def claim_next(db: Session) -> ClaimedMail | None:
    """Lease one due message, dropping links that have become unusable."""
    now = datetime.now(UTC)
    rows = db.scalars(
        select(MailOutbox)
        .where(
            MailOutbox.next_attempt_at <= now,
            (MailOutbox.leased_until.is_(None) | (MailOutbox.leased_until <= now)),
        )
        .order_by(MailOutbox.next_attempt_at, MailOutbox.created_at)
        .limit(10)
        .with_for_update(skip_locked=True)
    )
    for row in rows:
        purpose = "verify" if row.verification_token_id is not None else "reset"
        token = (
            db.get(EmailVerificationToken, row.verification_token_id)
            if row.verification_token_id is not None
            else db.get(PasswordResetToken, row.reset_token_id)
        )
        user = db.get(User, token.user_id) if token is not None else None
        usable = (
            token is not None
            and token.used_at is None
            and token.expires_at > now
            and user is not None
            and user.email == row.recipient
            and (
                (
                    purpose == "verify"
                    and user.role == "user"
                    and not user.is_active
                    and user.email_verified_at is None
                    and user.created_at > now - timedelta(days=7)
                )
                or (
                    purpose == "reset"
                    and user.role != "guest"
                    and user.is_active
                    and user.email_verified_at is not None
                )
            )
        )
        if not usable:
            db.delete(row)
            continue
        row.attempts += 1
        row.leased_until = now + LEASE
        db.commit()
        return ClaimedMail(row.id, row.recipient, row.encrypted_token, purpose)
    db.commit()
    return None


def delivered(db: Session, message_id: UUID) -> None:
    row = db.get(MailOutbox, message_id)
    if row is not None:
        db.delete(row)
    db.commit()


def retry_later(db: Session, message_id: UUID) -> None:
    row = db.get(MailOutbox, message_id)
    if row is not None:
        delay = min(30 * 2 ** min(row.attempts - 1, 7), 3600)
        row.next_attempt_at = datetime.now(UTC) + timedelta(seconds=delay)
        row.leased_until = None
    db.commit()
