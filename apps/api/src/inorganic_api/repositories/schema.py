from sqlalchemy import text
from sqlalchemy.orm import Session


def get_schema_revision(session: Session) -> str | None:
    """Return the Alembic revision applied to the database, or None if none is recorded."""
    return session.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
