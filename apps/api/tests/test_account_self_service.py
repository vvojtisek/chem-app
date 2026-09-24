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
from sqlalchemy.orm import Session

from inorganic_api.config import get_settings
from inorganic_api.database import session_dependency
from inorganic_api.errors import AppError
from inorganic_api.main import app
from inorganic_api.models import (
    AttemptEvent,
    EmailVerificationToken,
    MailOutbox,
    PasswordResetToken,
    User,
)
from inorganic_api.services import auth
from inorganic_api.services.email import decrypt_token
from inorganic_api.services.passwords import hash_password

API_DIR = Path(__file__).resolve().parents[1]
ORIGIN = "http://localhost:3000"
PASSWORD = "correct-horse-battery-staple"


@pytest.fixture(scope="module")
def engine():
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    name = make_url(database_url).database or ""
    if not (name.startswith("test_") or name.endswith("_test")):
        pytest.fail("TEST_DATABASE_URL must point to a clearly named test database")
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API_DIR,
        env={**os.environ, "DATABASE_URL": database_url},
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
def anyio_backend() -> str:
    return "asyncio"


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver")


def account(db: Session, role: str = "user") -> User:
    user = User(
        id=uuid4(),
        username=f"{role}_{uuid4().hex[:12]}",
        password_hash=hash_password(PASSWORD),
        role=role,
    )
    db.add(user)
    db.flush()
    return user


async def login(http: AsyncClient, user: User, password: str = PASSWORD) -> None:
    result = await http.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"username": user.username, "password": password},
    )
    assert result.status_code == 200, result.text


def csrf(http: AsyncClient) -> dict[str, str]:
    return {"Origin": ORIGIN, "X-CSRF-Token": http.cookies["__Host-inorganic_csrf"]}


def queued_token(db: Session, recipient: str, purpose: str) -> str:
    rows = (
        db.query(MailOutbox)
        .filter_by(recipient=recipient)
        .order_by(MailOutbox.created_at, MailOutbox.id)
        .all()
    )
    row = next(
        item for item in rows if (item.verification_token_id is not None) == (purpose == "verify")
    )
    return decrypt_token(get_settings(), row.encrypted_token)


def test_abuse_request_quota(db: Session) -> None:
    key = uuid4().hex
    settings = get_settings()
    assert auth.consume_rate_limit(db, settings, "test-quota", key, limit=2)
    assert auth.consume_rate_limit(db, settings, "test-quota", key, limit=2)
    assert not auth.consume_rate_limit(db, settings, "test-quota", key, limit=2)


@pytest.mark.anyio
async def test_registration_verification_password_change_and_reset(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    db.autoflush = False
    address = f"learner-{uuid4().hex[:10]}@example.test"
    async with client() as http:
        denied = await http.post("/api/v1/auth/register", json={"email": address})
        assert denied.status_code == 403
        response = await http.post(
            "/api/v1/auth/register",
            headers={"Origin": ORIGIN},
            json={"email": address.upper()},
        )
        assert response.status_code == 202, response.text
        assert db.query(MailOutbox).filter_by(recipient=address).count() == 1
        first_verify_token = queued_token(db, address, "verify")
        unverified = await http.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": address, "password": PASSWORD},
        )
        assert unverified.status_code == 401
        resent = await http.post(
            "/api/v1/auth/verification/request",
            headers={"Origin": ORIGIN},
            json={"email": address},
        )
        assert resent.status_code == 202
        assert db.query(MailOutbox).filter_by(recipient=address).count() == 1
        duplicate = await http.post(
            "/api/v1/auth/register",
            headers={"Origin": ORIGIN},
            json={"email": address},
        )
        assert duplicate.status_code == 202
        assert db.query(MailOutbox).filter_by(recipient=address).count() == 1
        replaced = await http.post(
            "/api/v1/auth/verify-email",
            headers={"Origin": ORIGIN},
            json={"token": first_verify_token, "newPassword": PASSWORD},
        )
        assert replaced.status_code == 400
        verification = (
            db.query(EmailVerificationToken)
            .filter_by(user_id=db.query(User).filter_by(email=address).one().id)
            .order_by(EmailVerificationToken.expires_at.desc())
            .first()
        )
        assert verification is not None
        current_verify_token = decrypt_token(
            get_settings(),
            db.query(MailOutbox)
            .filter_by(verification_token_id=verification.id)
            .one()
            .encrypted_token,
        )
        verified = await http.post(
            "/api/v1/auth/verify-email",
            headers={"Origin": ORIGIN},
            json={"token": current_verify_token, "newPassword": PASSWORD},
        )
        assert verified.status_code == 204, verified.text
        replay = await http.post(
            "/api/v1/auth/verify-email",
            headers={"Origin": ORIGIN},
            json={"token": current_verify_token, "newPassword": PASSWORD},
        )
        assert replay.status_code == 400
        signed_in = await http.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": address, "password": PASSWORD},
        )
        assert signed_in.status_code == 200, signed_in.text
        assert signed_in.json()["email"] == address
        assert signed_in.json()["role"] == "user"
        profile = await http.get("/api/v1/me/profile")
        assert profile.status_code == 200 and profile.json()["emailVerified"] is True
        edited = await http.patch(
            "/api/v1/me/profile", headers=csrf(http), json={"displayName": "Chemik"}
        )
        assert edited.status_code == 200 and edited.json()["displayName"] == "Chemik"
        bad_change = await http.post(
            "/api/v1/me/password",
            headers=csrf(http),
            json={"currentPassword": "wrong", "newPassword": "a-new-long-password"},
        )
        assert bad_change.status_code == 401
        changed = await http.post(
            "/api/v1/me/password",
            headers=csrf(http),
            json={"currentPassword": PASSWORD, "newPassword": "a-new-long-password"},
        )
        assert changed.status_code == 204
        assert (await http.get("/api/v1/auth/me")).status_code == 401
        unknown = await http.post(
            "/api/v1/auth/password-reset/request",
            headers={"Origin": ORIGIN},
            json={"email": f"unknown-{uuid4().hex[:8]}@example.test"},
        )
        known = await http.post(
            "/api/v1/auth/password-reset/request",
            headers={"Origin": ORIGIN},
            json={"email": address},
        )
        assert unknown.status_code == known.status_code == 202
        assert db.query(MailOutbox).filter_by(recipient=address).count() == 1
        reset_message = (
            db.query(MailOutbox)
            .filter(MailOutbox.reset_token_id.is_not(None), MailOutbox.recipient == address)
            .one()
        )
        reset_token = decrypt_token(get_settings(), reset_message.encrypted_token)
        reset = await http.post(
            "/api/v1/auth/password-reset/confirm",
            headers={"Origin": ORIGIN},
            json={"token": reset_token, "newPassword": "yet-another-long-password"},
        )
        assert reset.status_code == 204, reset.text
        replay = await http.post(
            "/api/v1/auth/password-reset/confirm",
            headers={"Origin": ORIGIN},
            json={"token": reset_token, "newPassword": "yet-another-long-password"},
        )
        assert replay.status_code == 400
        old_password = await http.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": address, "password": "a-new-long-password"},
        )
        assert old_password.status_code == 401
        new_password = await http.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": address, "password": "yet-another-long-password"},
        )
        assert new_password.status_code == 200


@pytest.mark.anyio
async def test_email_configuration_failure_and_expired_reset_are_safe(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def unavailable(*_args):
        raise AppError(503, "email_unavailable", "Email delivery is temporarily unavailable.")

    address = f"outage-{uuid4().hex[:8]}@example.test"
    async with client() as http:
        with monkeypatch.context() as patch:
            patch.setattr(
                "inorganic_api.services.accounts.email.require_delivery_config", unavailable
            )
            registration = await http.post(
                "/api/v1/auth/register",
                headers={"Origin": ORIGIN},
                json={"email": address},
            )
            recovery = await http.post(
                "/api/v1/auth/password-reset/request",
                headers={"Origin": ORIGIN},
                json={"email": address},
            )
            unknown_recovery = await http.post(
                "/api/v1/auth/password-reset/request",
                headers={"Origin": ORIGIN},
                json={"email": f"other-{uuid4().hex[:8]}@example.test"},
            )
        assert (
            registration.status_code == recovery.status_code == unknown_recovery.status_code == 503
        )
        assert db.query(User).filter_by(email=address).count() == 0
        learner = account(db)
        learner.email = address
        learner.email_verified_at = datetime.now(UTC)
        db.flush()
        known = await http.post(
            "/api/v1/auth/password-reset/request",
            headers={"Origin": ORIGIN},
            json={"email": address},
        )
        unknown = await http.post(
            "/api/v1/auth/password-reset/request",
            headers={"Origin": ORIGIN},
            json={"email": f"other-{uuid4().hex[:8]}@example.test"},
        )
        assert known.status_code == unknown.status_code == 202
        token_row = db.query(PasswordResetToken).filter_by(user_id=learner.id).one()
        reset_message = db.query(MailOutbox).filter_by(reset_token_id=token_row.id).one()
        token = decrypt_token(get_settings(), reset_message.encrypted_token)
        assert token_row.token_hash != token
        token_row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.flush()
        expired = await http.post(
            "/api/v1/auth/password-reset/confirm",
            headers={"Origin": ORIGIN},
            json={"token": token, "newPassword": "another-new-long-password"},
        )
        assert expired.status_code == 400


@pytest.mark.anyio
async def test_guest_session_is_read_only(db: Session) -> None:
    async with client() as http:
        guest = await http.post("/api/v1/auth/guest", headers={"Origin": ORIGIN})
        assert guest.status_code == 200 and guest.json()["role"] == "guest"
        assert (await http.get("/api/v1/auth/me")).status_code == 200
        assert (await http.get("/api/v1/me/profile")).status_code == 403
        assert (await http.get("/api/v1/me/progression")).status_code == 403
        assert (await http.get("/api/v1/me/attempt-events")).status_code == 403
        assert (await http.get("/api/v1/admin/users")).status_code == 403
        changed = await http.patch(
            "/api/v1/me/profile", headers=csrf(http), json={"displayName": "Not allowed"}
        )
        assert changed.status_code == 403
        password = await http.post(
            "/api/v1/me/password",
            headers=csrf(http),
            json={"currentPassword": PASSWORD, "newPassword": "another-long-password"},
        )
        assert password.status_code == 403
        event = {
            "id": "guest-event",
            "questionId": "H",
            "contentVersion": "v1",
            "occurredAt": datetime.now(UTC).isoformat(),
            "isCorrect": True,
            "round": "initial",
            "mode": "element-name",
            "direction": "symbol-to-name",
            "matchPolicy": "diacritics-tolerant",
        }
        uploaded = await http.post(
            "/api/v1/me/attempt-events/batch", headers=csrf(http), json={"events": [event]}
        )
        assert uploaded.status_code == 403


@pytest.mark.anyio
async def test_admin_profile_and_password_management(db: Session) -> None:
    admin = account(db, "admin")
    learner = account(db)
    async with client() as http:
        await login(http, learner)
        denied = await http.patch(
            f"/api/v1/admin/users/{admin.id}/profile",
            headers=csrf(http),
            json={"displayName": "Denied"},
        )
        assert denied.status_code == 403
        await login(http, admin)
        last_admin = await http.patch(
            f"/api/v1/admin/users/{admin.id}/profile",
            headers=csrf(http),
            json={"isActive": False},
        )
        assert last_admin.status_code == 409
        demotion = await http.patch(
            f"/api/v1/admin/users/{admin.id}/profile",
            headers=csrf(http),
            json={"role": "user"},
        )
        assert demotion.status_code == 409
        updated = await http.patch(
            f"/api/v1/admin/users/{learner.id}/profile",
            headers=csrf(http),
            json={"email": "managed@example.test", "displayName": "Managed"},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["emailVerified"] is True
        changed = await http.post(
            f"/api/v1/admin/users/{learner.id}/password",
            headers=csrf(http),
            json={"newPassword": "managed-new-password"},
        )
        assert changed.status_code == 204
        await login(http, learner, "managed-new-password")


@pytest.mark.anyio
async def test_progression_uses_server_received_attempts(db: Session) -> None:
    learner = account(db)
    now = datetime.now(UTC)
    for index in range(51):
        db.add(
            AttemptEvent(
                user_id=learner.id,
                event_id=f"progress-{index}",
                mode="element-name",
                question_id="H",
                content_version="v1",
                occurred_at=now - timedelta(days=100),
                received_at=now,
                is_correct=index < 50,
                payload={},
                payload_hash=f"{index:064x}",
            )
        )
    db.flush()
    async with client() as http:
        await login(http, learner)
        result = await http.get("/api/v1/me/progression")
        assert result.status_code == 200, result.text
        body = result.json()
        assert body["totalAttempts"] == 51
        assert body["correctAttempts"] == 50
        assert body["rank"] == {
            "id": "student",
            "title": "Student",
            "minimumCorrectAttempts": 50,
            "nextRankAt": 250,
        }
        assert body["trend"][-1] == {
            "day": now.date().isoformat(),
            "totalAttempts": 51,
            "correctAttempts": 50,
        }
        assert len(body["trend"]) == 30
        tester = account(db, "tester")
        await login(http, tester)
        assert (await http.get("/api/v1/me/progression")).status_code == 403
