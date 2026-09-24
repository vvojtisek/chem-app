from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from inorganic_api.models import User


def get_by_username(session: Session, username: str) -> User | None:
    return session.scalar(select(User).where(User.username == username))


def get_by_email(session: Session, email: str) -> User | None:
    return session.scalar(select(User).where(User.email == email))


def get_by_id(session: Session, user_id: UUID) -> User | None:
    return session.get(User, user_id)


def active_admins_for_update(session: Session) -> list[User]:
    return list(
        session.scalars(
            select(User)
            .where(User.role == "admin", User.is_active.is_(True))
            .order_by(User.id)
            .with_for_update()
        )
    )
