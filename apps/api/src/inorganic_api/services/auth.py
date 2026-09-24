import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from inorganic_api.config import Settings
from inorganic_api.errors import AppError
from inorganic_api.models import AuthSession, LoginThrottle, User
from inorganic_api.repositories import sessions, users
from inorganic_api.services.passwords import hash_password, needs_rehash, verify_password

THROTTLE_WINDOW = timedelta(minutes=15)
USER_FAILURE_LIMIT = 5
IP_FAILURE_LIMIT = 30
SESSION_TOUCH_INTERVAL = timedelta(minutes=5)
GUEST_USERNAME = "__guest__"


@dataclass(frozen=True)
class AuthenticatedSession:
    user: User
    session: AuthSession


@dataclass(frozen=True)
class NewSession:
    user: User
    session_token: str
    csrf_token: str


def normalize_username(username: str) -> str:
    return username.strip().lower()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _throttle_hash(secret_key: str, kind: str, value: str) -> str:
    return hmac.new(
        secret_key.encode("utf-8"), f"{kind}:{value}".encode(), hashlib.sha256
    ).hexdigest()


def _lock_throttle_rows(
    db: Session, settings: Settings, username: str, ip_address: str, now: datetime
) -> list[tuple[LoginThrottle, int]]:
    keys = [
        (_throttle_hash(settings.secret_key, "ip", ip_address), IP_FAILURE_LIMIT),
        (_throttle_hash(settings.secret_key, "username", username), USER_FAILURE_LIMIT),
    ]
    # Insert first, then lock in a stable order so concurrent workers share counters.
    for key, _ in sorted(keys):
        db.execute(
            insert(LoginThrottle)
            .values(key_hash=key, window_start=now, failures=0)
            .on_conflict_do_nothing(index_elements=[LoginThrottle.key_hash])
        )
    rows: list[tuple[LoginThrottle, int]] = []
    for key, limit in sorted(keys):
        row = db.scalar(
            select(LoginThrottle).where(LoginThrottle.key_hash == key).with_for_update()
        )
        if row is None:
            raise RuntimeError("Login throttle row was not available after insert.")
        if now - row.window_start >= THROTTLE_WINDOW:
            row.window_start = now
            row.failures = 0
        rows.append((row, limit))
    return rows


def login(
    db: Session,
    settings: Settings,
    username: str,
    password: str,
    ip_address: str,
    previous_token: str | None,
) -> NewSession:
    now = datetime.now(UTC)
    normalized = normalize_username(username)
    rows = _lock_throttle_rows(db, settings, normalized, ip_address, now)
    retry_after = max(
        (
            max(1, int((row.window_start + THROTTLE_WINDOW - now).total_seconds()) + 1)
            for row, limit in rows
            if row.failures >= limit
        ),
        default=0,
    )
    if retry_after:
        db.commit()
        raise AppError(
            429,
            "too_many_attempts",
            "Too many login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    user = (
        users.get_by_email(db, normalized)
        if "@" in normalized
        else users.get_by_username(db, normalized)
    )
    if not verify_password(
        user.password_hash if user and user.is_active and user.role != "guest" else None,
        password,
    ):
        for row, _ in rows:
            row.failures += 1
        db.commit()
        raise AppError(401, "invalid_credentials", "Invalid username or password.")

    if user is None:
        raise AppError(401, "invalid_credentials", "Invalid username or password.")
    result = create_session(db, settings, user, previous_token, now)
    user.last_login_at = now
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    db.commit()
    return result


def create_session(
    db: Session,
    settings: Settings,
    user: User,
    previous_token: str | None,
    now: datetime | None = None,
) -> NewSession:
    now = now or datetime.now(UTC)
    if previous_token and len(previous_token) <= 256:
        sessions.revoke_by_token_hash(db, token_hash(previous_token))
    session_token = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=token_hash(session_token),
            csrf_hash=token_hash(csrf_token),
            last_seen_at=now,
            idle_expires_at=now + timedelta(seconds=settings.session_idle_ttl),
            absolute_expires_at=now + timedelta(seconds=settings.session_absolute_ttl),
        )
    )
    return NewSession(user=user, session_token=session_token, csrf_token=csrf_token)


def guest_login(
    db: Session, settings: Settings, ip_address: str, previous_token: str | None
) -> NewSession:
    if not consume_rate_limit(db, settings, "guest-ip", ip_address, limit=30):
        raise AppError(429, "too_many_attempts", "Too many requests. Try again later.")
    user = users.get_by_username(db, GUEST_USERNAME)
    if user is None:
        db.execute(
            insert(User)
            .values(
                username=GUEST_USERNAME,
                password_hash=hash_password(secrets.token_urlsafe(32)),
                role="guest",
                is_active=True,
            )
            .on_conflict_do_nothing(index_elements=[User.username])
        )
        user = users.get_by_username(db, GUEST_USERNAME)
    if user is None or user.role != "guest":
        raise RuntimeError("Guest account was not available after insert.")
    result = create_session(db, settings, user, previous_token)
    db.commit()
    return result


def consume_rate_limit(
    db: Session, settings: Settings, kind: str, value: str, *, limit: int
) -> bool:
    """Consume a request quota. Return False after the per-key window is full."""
    now = datetime.now(UTC)
    key = _throttle_hash(settings.secret_key, kind, value)
    db.execute(
        insert(LoginThrottle)
        .values(key_hash=key, window_start=now, failures=0)
        .on_conflict_do_nothing(index_elements=[LoginThrottle.key_hash])
    )
    row = db.scalar(select(LoginThrottle).where(LoginThrottle.key_hash == key).with_for_update())
    if row is None:
        raise RuntimeError("Rate limit row was not available after insert.")
    if now - row.window_start >= THROTTLE_WINDOW:
        row.window_start = now
        row.failures = 0
    if row.failures >= limit:
        db.commit()
        return False
    row.failures += 1
    db.commit()
    return True


def resolve_session(
    db: Session, settings: Settings, session_token: str | None
) -> AuthenticatedSession:
    if not session_token or len(session_token) > 256:
        raise AppError(401, "unauthorized", "Authentication required.")
    auth_session = sessions.get_by_token_hash(db, token_hash(session_token))
    now = datetime.now(UTC)
    if auth_session is None:
        raise AppError(401, "unauthorized", "Authentication required.")
    if auth_session.idle_expires_at <= now or auth_session.absolute_expires_at <= now:
        db.delete(auth_session)
        db.commit()
        raise AppError(401, "unauthorized", "Authentication required.")
    user = auth_session.user
    if not user.is_active:
        raise AppError(401, "unauthorized", "Authentication required.")
    if now - auth_session.last_seen_at >= SESSION_TOUCH_INTERVAL:
        auth_session.last_seen_at = now
        auth_session.idle_expires_at = min(
            now + timedelta(seconds=settings.session_idle_ttl), auth_session.absolute_expires_at
        )
        db.commit()
    return AuthenticatedSession(user=user, session=auth_session)


def require_csrf_token(
    settings: Settings, auth_session: AuthSession, csrf_token: str | None, origin: str | None
) -> None:
    require_origin(settings, origin)
    if not csrf_token or len(csrf_token) > 256:
        raise AppError(403, "invalid_csrf", "Invalid CSRF token.")
    if not hmac.compare_digest(token_hash(csrf_token), auth_session.csrf_hash):
        raise AppError(403, "invalid_csrf", "Invalid CSRF token.")


def require_origin(settings: Settings, origin: str | None) -> None:
    if origin != str(settings.public_origin).rstrip("/"):
        raise AppError(403, "invalid_origin", "Request origin is not allowed.")


def logout(db: Session, token: str | None) -> None:
    if token and len(token) <= 256:
        sessions.revoke_by_token_hash(db, token_hash(token))
        db.commit()
