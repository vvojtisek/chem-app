from datetime import datetime, timedelta

from sqlalchemy import delete, exists, or_, select
from sqlalchemy.orm import Session

from inorganic_api.models import (
    AuthSession,
    EmailVerificationToken,
    LoginThrottle,
    MailOutbox,
    PasswordResetToken,
    User,
)


def delete_stale_throttles(db: Session, now: datetime) -> int:
    result = db.execute(
        delete(LoginThrottle).where(LoginThrottle.window_start < now - timedelta(days=1))
    )
    return result.rowcount or 0


def delete_obsolete_tokens(db: Session, now: datetime) -> int:
    verification_result = db.execute(
        delete(EmailVerificationToken).where(
            or_(
                EmailVerificationToken.used_at.is_not(None),
                EmailVerificationToken.expires_at <= now,
            )
        )
    )
    reset_result = db.execute(
        delete(PasswordResetToken).where(
            or_(PasswordResetToken.used_at.is_not(None), PasswordResetToken.expires_at <= now)
        )
    )
    return (verification_result.rowcount or 0) + (reset_result.rowcount or 0)


def delete_expired_unverified_users(db: Session, now: datetime) -> int:
    result = db.execute(
        delete(User).where(
            User.role == "user",
            User.is_active.is_(False),
            User.email_verified_at.is_(None),
            User.created_at <= now - timedelta(days=7),
        )
    )
    return result.rowcount or 0


def delete_inactive_guest_accounts(db: Session, now: datetime, guest_max_age: timedelta) -> int:
    active_session = exists(
        select(AuthSession.id).where(
            AuthSession.user_id == User.id,
            AuthSession.idle_expires_at > now,
            AuthSession.absolute_expires_at > now,
        )
    )
    result = db.execute(
        delete(User).where(
            User.role == "guest",
            User.created_at <= now - guest_max_age,
            ~active_session,
        )
    )
    return result.rowcount or 0


def delete_old_mail_outbox(db: Session, now: datetime) -> int:
    result = db.execute(delete(MailOutbox).where(MailOutbox.created_at < now - timedelta(days=7)))
    return result.rowcount or 0
