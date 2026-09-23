from sqlalchemy import select
from sqlalchemy.orm import Session

from inorganic_api.models import User


def get_by_username(session: Session, username: str) -> User | None:
    return session.scalar(select(User).where(User.username == username))
