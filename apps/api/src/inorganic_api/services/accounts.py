"""Verified account creation, recovery, and profile mutations."""

import re
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from inorganic_api.config import Settings
from inorganic_api.errors import AppError
from inorganic_api.models import EmailVerificationToken, PasswordResetToken, User
from inorganic_api.repositories import account_tokens, mail_outbox, sessions, users
from inorganic_api.services import auth, email
from inorganic_api.services.passwords import hash_password, verify_password

EMAIL_PATTERN = re.compile(
    r"^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$"
)
VERIFY_TTL = timedelta(hours=24)
RESET_TTL = timedelta(minutes=30)
UNVERIFIED_TTL = timedelta(days=7)


def normalize_email(value: str) -> str:
    result = value.strip().lower()
    if (
        len(result) > 254
        or not EMAIL_PATTERN.fullmatch(result)
        or ".." in result.split("@", 1)[0]
        or any(len(label) > 63 for label in result.split("@", 1)[1].split("."))
    ):
        raise ValueError("invalid email address")
    return result


def _new_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, auth.token_hash(token)


def register(db: Session, settings: Settings, address: str, ip: str) -> None:
    email.require_delivery_config(settings)
    if not auth.consume_rate_limit(db, settings, "register-ip", ip, limit=10):
        raise AppError(429, "too_many_attempts", "Too many requests. Try again later.")
    if not auth.consume_rate_limit(db, settings, "register-email", address, limit=3):
        return
    now = datetime.now(UTC)
    db.execute(
        delete(User).where(
            User.email == address,
            User.role == "user",
            User.is_active.is_(False),
            User.email_verified_at.is_(None),
            User.created_at <= now - UNVERIFIED_TTL,
        )
    )
    account_id = uuid4()
    username = f"user_{account_id.hex}"
    inserted = db.scalar(
        insert(User)
        .values(
            id=account_id,
            username=username,
            email=address,
            display_name=address.split("@", 1)[0][:80],
            password_hash="!pending-email-verification",
            role="user",
            is_active=False,
        )
        .on_conflict_do_nothing(index_elements=[User.email])
        .returning(User.id)
    )
    if inserted is None:
        db.commit()
        return
    token, digest = _new_token()
    verification = EmailVerificationToken(
        id=uuid4(), user_id=inserted, token_hash=digest, expires_at=now + VERIFY_TTL
    )
    db.add(verification)
    db.flush([verification])
    mail_outbox.enqueue_verification(
        db, address, email.encrypt_token(settings, token), verification
    )
    db.commit()


def request_verification(db: Session, settings: Settings, address: str, ip: str) -> None:
    email.require_delivery_config(settings)
    if not auth.consume_rate_limit(db, settings, "verify-request-ip", ip, limit=20):
        raise AppError(429, "too_many_attempts", "Too many requests. Try again later.")
    if not auth.consume_rate_limit(db, settings, "verify-request-email", address, limit=3):
        return
    user = users.get_by_email(db, address)
    if (
        user is None
        or user.role != "user"
        or user.is_active
        or user.email_verified_at is not None
        or user.created_at <= datetime.now(UTC) - UNVERIFIED_TTL
    ):
        db.commit()
        return
    now = datetime.now(UTC)
    token, digest = _new_token()
    account_tokens.revoke_verifications(db, user.id, now)
    verification = EmailVerificationToken(
        id=uuid4(), user_id=user.id, token_hash=digest, expires_at=now + VERIFY_TTL
    )
    db.add(verification)
    db.flush([verification])
    mail_outbox.enqueue_verification(
        db, address, email.encrypt_token(settings, token), verification
    )
    db.commit()


def verify_email(db: Session, settings: Settings, token: str, password: str, ip: str) -> None:
    if not auth.consume_rate_limit(db, settings, "verify-ip", ip, limit=30):
        raise AppError(429, "too_many_attempts", "Too many requests. Try again later.")
    row = account_tokens.verification_for_update(db, auth.token_hash(token))
    now = datetime.now(UTC)
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise AppError(400, "invalid_token", "This link is invalid or has expired.")
    user = users.get_by_id(db, row.user_id)
    if (
        user is None
        or user.role != "user"
        or user.email_verified_at is not None
        or user.created_at <= now - UNVERIFIED_TTL
    ):
        raise AppError(400, "invalid_token", "This link is invalid or has expired.")
    row.used_at = now
    user.password_hash = hash_password(password)
    user.password_changed_at = now
    user.email_verified_at = now
    user.is_active = True
    # The API session factory disables autoflush. Persist token consumption before
    # deleting the other outstanding verification tokens for this account.
    db.flush()
    account_tokens.revoke_verifications(db, user.id, now)
    db.commit()


def request_reset(db: Session, settings: Settings, address: str, ip: str) -> None:
    email.require_delivery_config(settings)
    if not auth.consume_rate_limit(db, settings, "reset-ip", ip, limit=20):
        raise AppError(429, "too_many_attempts", "Too many requests. Try again later.")
    if not auth.consume_rate_limit(db, settings, "reset-email", address, limit=3):
        return
    user = users.get_by_email(db, address)
    if user is None or not user.is_active or user.email_verified_at is None:
        db.commit()
        return
    token, digest = _new_token()
    reset = PasswordResetToken(
        id=uuid4(),
        user_id=user.id,
        token_hash=digest,
        expires_at=datetime.now(UTC) + RESET_TTL,
    )
    db.add(reset)
    db.flush([reset])
    mail_outbox.enqueue_reset(db, address, email.encrypt_token(settings, token), reset)
    db.commit()


def confirm_reset(db: Session, settings: Settings, token: str, password: str, ip: str) -> None:
    if not auth.consume_rate_limit(db, settings, "reset-confirm-ip", ip, limit=30):
        raise AppError(429, "too_many_attempts", "Too many requests. Try again later.")
    row = account_tokens.reset_for_update(db, auth.token_hash(token))
    now = datetime.now(UTC)
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise AppError(400, "invalid_token", "This link is invalid or has expired.")
    user = users.get_by_id(db, row.user_id)
    if user is None or not user.is_active or user.email_verified_at is None:
        raise AppError(400, "invalid_token", "This link is invalid or has expired.")
    row.used_at = now
    user.password_hash = hash_password(password)
    user.password_changed_at = now
    sessions.revoke_for_user(db, user.id)
    account_tokens.revoke_resets(db, user.id)
    db.commit()


def change_password(db: Session, actor: User, current: str, password: str) -> None:
    if actor.role == "guest":
        raise AppError(403, "forbidden", "Access denied.")
    if not verify_password(actor.password_hash, current):
        raise AppError(401, "invalid_credentials", "Invalid current password.")
    _set_password(db, actor, password)


def admin_set_password(db: Session, actor: User, user_id: UUID, password: str) -> None:
    if actor.role != "admin":
        raise AppError(403, "forbidden", "Access denied.")
    target = users.get_by_id(db, user_id)
    if target is None or target.role == "guest":
        raise AppError(404, "not_found", "Account not found.")
    _set_password(db, target, password)


def _set_password(db: Session, user: User, password: str) -> None:
    user.password_hash = hash_password(password)
    user.password_changed_at = datetime.now(UTC)
    sessions.revoke_for_user(db, user.id)
    account_tokens.revoke_resets(db, user.id)
    db.commit()


def profile(db: Session, actor: User) -> User:
    if actor.role == "guest":
        raise AppError(403, "forbidden", "Access denied.")
    return actor


def update_profile(db: Session, actor: User, display_name: str | None) -> User:
    profile(db, actor)
    actor.display_name = display_name
    db.commit()
    return actor


def admin_update_profile(db: Session, actor: User, user_id: UUID, changes: dict) -> User:
    if actor.role != "admin":
        raise AppError(403, "forbidden", "Access denied.")
    target = users.get_by_id(db, user_id)
    if target is None or target.role == "guest":
        raise AppError(404, "not_found", "Account not found.")
    if (
        target.role == "admin"
        and target.is_active
        and (changes.get("role", "admin") != "admin" or changes.get("is_active", True) is False)
    ):
        admins = users.active_admins_for_update(db)
        if len(admins) <= 1:
            raise AppError(409, "last_admin", "The last active administrator cannot be disabled.")
    if "email" in changes:
        address = changes["email"]
        if address is not None and address != target.email:
            target.email = address
            target.email_verified_at = datetime.now(UTC)
        elif address is None:
            target.email = None
            target.email_verified_at = None
    if "display_name" in changes:
        target.display_name = changes["display_name"]
    if "role" in changes:
        target.role = changes["role"]
    if "is_active" in changes:
        target.is_active = changes["is_active"]
    if not target.is_active or ("role" in changes and target.id == actor.id):
        sessions.revoke_for_user(db, target.id)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "email_taken", "This email address is already in use.") from exc
    return target


def admin_get_profile(db: Session, actor: User, user_id: UUID) -> User:
    if actor.role != "admin":
        raise AppError(403, "forbidden", "Access denied.")
    target = users.get_by_id(db, user_id)
    if target is None or target.role == "guest":
        raise AppError(404, "not_found", "Account not found.")
    return target
