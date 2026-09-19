from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from inorganic_api.config import get_settings


class Base(DeclarativeBase):
    pass


def create_session_factory() -> sessionmaker[Session]:
    engine = create_engine(get_settings().database_url, pool_pre_ping=True)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def session_dependency() -> Iterator[Session]:
    session_factory = create_session_factory()
    with session_factory() as session:
        yield session
