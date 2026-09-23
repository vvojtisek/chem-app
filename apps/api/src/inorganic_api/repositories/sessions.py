from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from inorganic_api.models import AuthSession


def get_by_token_hash(session: Session, token_hash: str) -> AuthSession | None:
    return session.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))


def revoke_by_token_hash(session: Session, token_hash: str) -> None:
    session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))


def revoke_for_user(session: Session, user_id: object) -> None:
    session.execute(delete(AuthSession).where(AuthSession.user_id == user_id))


def purge_expired(session: Session, now: datetime) -> int:
    result = session.execute(
        delete(AuthSession).where(
            (AuthSession.idle_expires_at <= now) | (AuthSession.absolute_expires_at <= now)
        )
    )
    return result.rowcount or 0
