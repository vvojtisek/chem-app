import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from inorganic_api.cli import seed_accounts, set_password
from inorganic_api.database import session_dependency
from inorganic_api.main import app
from inorganic_api.models import AuthSession, User
from inorganic_api.repositories import sessions
from inorganic_api.services.passwords import hash_password, verify_password

API_DIR = Path(__file__).resolve().parents[1]
ORIGIN = "http://localhost:3000"


@pytest.fixture(scope="module")
def engine():
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    database_name = make_url(database_url).database or ""
    if not (database_name.startswith("test_") or database_name.endswith("_test")):
        pytest.fail("TEST_DATABASE_URL must point to a clearly named test database")
    environment = {**os.environ, "DATABASE_URL": database_url}
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API_DIR,
        env=environment,
        check=True,
    )
    result = create_engine(database_url, pool_pre_ping=True)
    yield result
    result.dispose()


@pytest.fixture
def db(engine):
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")

        def override_session():
            yield session

        app.dependency_overrides[session_dependency] = override_session
        try:
            yield session
        finally:
            app.dependency_overrides.pop(session_dependency, None)
            session.close()
            transaction.rollback()


@pytest.fixture
def user(db: Session) -> User:
    account = User(
        id=uuid4(),
        username=f"learner_{uuid4().hex[:12]}",
        password_hash=hash_password("correct-horse-battery-staple"),
        role="user",
    )
    db.add(account)
    db.flush()
    return account


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver")


async def _login(client: AsyncClient, user: User, password: str = "correct-horse-battery-staple"):
    return await client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"username": user.username, "password": password},
    )


@pytest.mark.anyio
async def test_login_me_logout_and_cookie_security(db: Session, user: User) -> None:
    async with _client() as client:
        login = await _login(client, user)
        assert login.status_code == 200
        assert login.json() == {
            "id": str(user.id),
            "username": user.username,
            "role": "user",
            "email": None,
            "displayName": None,
        }
        assert any(
            cookie.startswith("__Host-inorganic_session=")
            and "httponly" in cookie.lower()
            and "secure" in cookie.lower()
            and "samesite=strict" in cookie.lower()
            for cookie in login.headers.get_list("set-cookie")
        )
        assert (await client.get("/api/v1/auth/me")).status_code == 200
        csrf = client.cookies["__Host-inorganic_csrf"]
        logout = await client.post(
            "/api/v1/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-Token": csrf}
        )
        assert logout.status_code == 204
        assert (await client.get("/api/v1/auth/me")).status_code == 401


@pytest.mark.anyio
async def test_missing_bad_expired_revoked_and_inactive_sessions(db: Session, user: User) -> None:
    async with _client() as client:
        assert (await client.get("/api/v1/auth/me")).status_code == 401
        client.cookies.set("__Host-inorganic_session", "malformed")
        assert (await client.get("/api/v1/auth/me")).status_code == 401
        client.cookies.clear()
        assert (await _login(client, user)).status_code == 200
        token = client.cookies["__Host-inorganic_session"]
        session = db.query(AuthSession).filter_by(user_id=user.id).one()
        session.idle_expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.flush()
        assert (await client.get("/api/v1/auth/me")).status_code == 401
        assert db.query(AuthSession).filter_by(user_id=user.id).count() == 0
        client.cookies.clear()
        assert (await _login(client, user)).status_code == 200
        session = db.query(AuthSession).filter_by(user_id=user.id).one()
        db.delete(session)
        db.flush()
        assert (await client.get("/api/v1/auth/me")).status_code == 401
        client.cookies.clear()
        assert (await _login(client, user)).status_code == 200
        user.is_active = False
        db.flush()
        assert (await client.get("/api/v1/auth/me")).status_code == 401
        assert token


@pytest.mark.anyio
async def test_invalid_credentials_have_same_message_and_throttle(db: Session, user: User) -> None:
    async with _client() as client:
        wrong = await _login(client, user, "incorrect")
        unknown = await client.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"username": "unknown_account", "password": "incorrect"},
        )
        assert wrong.status_code == unknown.status_code == 401
        assert wrong.json()["error"]["message"] == unknown.json()["error"]["message"]
        for _ in range(4):
            assert (await _login(client, user, "incorrect")).status_code == 401
        limited = await _login(client, user, "incorrect")
        assert limited.status_code == 429
        assert limited.json()["error"]["code"] == "too_many_attempts"
        assert int(limited.headers["Retry-After"]) > 0


@pytest.mark.anyio
async def test_csrf_origin_rotation_and_validation(db: Session, user: User) -> None:
    async with _client() as client:
        bad_origin = await client.post(
            "/api/v1/auth/login",
            headers={"Origin": "https://other.example"},
            json={"username": user.username, "password": "correct-horse-battery-staple"},
        )
        assert bad_origin.status_code == 403
        extra = await client.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={
                "username": user.username,
                "password": "correct-horse-battery-staple",
                "role": "admin",
            },
        )
        assert extra.status_code == 422
        assert (await _login(client, user)).status_code == 200
        old_token = client.cookies["__Host-inorganic_session"]
        assert (await _login(client, user)).status_code == 200
        assert client.cookies["__Host-inorganic_session"] != old_token
        assert db.query(AuthSession).filter_by(user_id=user.id).count() == 1
        missing = await client.post("/api/v1/auth/logout", headers={"Origin": ORIGIN})
        assert missing.status_code == 403
        bad_csrf = await client.post(
            "/api/v1/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-Token": "wrong"}
        )
        assert bad_csrf.status_code == 403
        wrong_origin = await client.post(
            "/api/v1/auth/logout",
            headers={
                "Origin": "https://other.example",
                "X-CSRF-Token": client.cookies["__Host-inorganic_csrf"],
            },
        )
        assert wrong_origin.status_code == 403
        assert (await client.get("/api/v1/auth/me")).status_code == 200


@pytest.mark.anyio
async def test_request_id_is_validated(db: Session) -> None:
    async with _client() as client:
        response = await client.get("/api/v1/auth/me", headers={"X-Request-ID": "bad id\n"})
        assert response.status_code == 401
        assert response.headers["X-Request-ID"] != "bad id\n"
        assert response.json()["error"]["requestId"] == response.headers["X-Request-ID"]


@pytest.mark.anyio
async def test_readiness_checks_database(db: Session) -> None:
    async with _client() as client:
        response = await client.get("/api/v1/health/ready")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


@pytest.mark.anyio
async def test_readiness_failure_has_safe_error_envelope(db: Session) -> None:
    class FailedDatabase:
        def execute(self, _statement):
            raise SQLAlchemyError("internal connection detail")

    def failed_session():
        yield FailedDatabase()

    app.dependency_overrides[session_dependency] = failed_session
    try:
        async with _client() as client:
            response = await client.get("/api/v1/health/ready")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "unavailable"
        assert "internal connection detail" not in response.text
    finally:
        app.dependency_overrides[session_dependency] = lambda: db


def test_openapi_declares_cookie_auth_for_protected_operations() -> None:
    document = app.openapi()
    schemes = document["components"]["securitySchemes"]
    assert schemes["InorganicSessionCookie"] == {
        "type": "apiKey",
        "in": "cookie",
        "name": "__Host-inorganic_session",
        "description": "Opaque server-side browser session cookie.",
    }
    assert document["paths"]["/api/v1/auth/me"]["get"]["security"] == [
        {"InorganicSessionCookie": []}
    ]
    assert document["paths"]["/api/v1/auth/logout"]["post"]["security"] == [
        {"InorganicSessionCookie": []}
    ]
    assert (
        document["paths"]["/api/v1/auth/logout"]["post"]["responses"]["422"]["content"][
            "application/json"
        ]["schema"]["$ref"]
        == "#/components/schemas/ErrorEnvelope"
    )


def test_seed_is_idempotent_and_password_change_revokes_sessions(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    seed_usernames = {
        role: f"seed_{role}_{uuid4().hex[:8]}" for role in ("admin", "user", "tester")
    }
    for role, username in seed_usernames.items():
        monkeypatch.setenv(f"SEED_{role.upper()}_USERNAME", username)
        monkeypatch.setenv(f"SEED_{role.upper()}_PASSWORD", f"Different-Strong-{role}-Passphrase")
    assert seed_accounts(db) == 3
    account = db.query(User).filter_by(username=seed_usernames["user"]).one()
    original_hash = account.password_hash
    assert seed_accounts(db) == 0
    assert account.password_hash == original_hash
    db.add(
        AuthSession(
            user_id=account.id,
            token_hash="a" * 64,
            csrf_hash="b" * 64,
            last_seen_at=datetime.now(UTC),
            idle_expires_at=datetime.now(UTC) + timedelta(days=1),
            absolute_expires_at=datetime.now(UTC) + timedelta(days=2),
        )
    )
    db.flush()
    passwords = iter(("Fresh-Strong-User-Passphrase", "Fresh-Strong-User-Passphrase"))
    monkeypatch.setattr("inorganic_api.cli.getpass.getpass", lambda _prompt: next(passwords))
    set_password(db, account.username)
    assert account.password_hash != original_hash
    assert verify_password(account.password_hash, "Fresh-Strong-User-Passphrase")
    assert db.query(AuthSession).filter_by(user_id=account.id).count() == 0
    for token_hash in ("c" * 64, "d" * 64):
        db.add(
            AuthSession(
                user_id=account.id,
                token_hash=token_hash,
                csrf_hash=token_hash[::-1],
                last_seen_at=datetime.now(UTC),
                idle_expires_at=datetime.now(UTC) + timedelta(days=1),
                absolute_expires_at=datetime.now(UTC) + timedelta(days=2),
            )
        )
    db.flush()
    assert sessions.revoke_all(db) == 2
    assert db.query(AuthSession).filter_by(user_id=account.id).count() == 0
