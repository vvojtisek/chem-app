import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

API_DIR = Path(__file__).resolve().parents[1]


def _alembic(database_url: str, *args: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=API_DIR,
        env={**os.environ, "DATABASE_URL": database_url},
        check=True,
    )


def test_migration_deletes_only_pending_self_registrations() -> None:
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    name = make_url(database_url).database or ""
    if not (name.startswith("test_") or name.endswith("_test")):
        pytest.fail("TEST_DATABASE_URL must point to a clearly named test database")
    _alembic(database_url, "upgrade", "head")
    _alembic(database_url, "downgrade", "0006_daily_goal")
    engine = create_engine(database_url)
    pending, kept_inactive, kept_active = uuid4(), uuid4(), uuid4()
    rows = [
        (pending, "!pending-email-verification", False),
        (kept_inactive, "$argon2id$disabled-with-real-password", False),
        (kept_active, "$argon2id$active", True),
    ]
    try:
        with engine.begin() as connection:
            for user_id, password_hash, is_active in rows:
                connection.execute(
                    text(
                        "INSERT INTO users (id, username, email, password_hash, role, is_active)"
                        " VALUES (:id, :username, :email, :hash, 'user', :active)"
                    ),
                    {
                        "id": user_id,
                        "username": f"user_{user_id.hex}",
                        "email": f"{user_id.hex}@example.test",
                        "hash": password_hash,
                        "active": is_active,
                    },
                )
        _alembic(database_url, "upgrade", "head")
        with engine.connect() as connection:
            remaining = set(
                connection.scalars(
                    text("SELECT id FROM users WHERE id IN (:a, :b, :c)"),
                    {"a": pending, "b": kept_inactive, "c": kept_active},
                )
            )
            default_purpose = connection.scalar(
                text(
                    "SELECT column_default FROM information_schema.columns"
                    " WHERE table_name = 'password_reset_tokens' AND column_name = 'purpose'"
                )
            )
        assert remaining == {kept_inactive, kept_active}
        assert default_purpose is not None and "reset" in default_purpose
    finally:
        _alembic(database_url, "upgrade", "head")
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM users WHERE id IN (:a, :b, :c)"),
                {"a": pending, "b": kept_inactive, "c": kept_active},
            )
        engine.dispose()
