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
    MailOutbox,
    PasswordResetToken,
    User,
)
from inorganic_api.repositories import mail_outbox
from inorganic_api.services import accounts, auth, maintenance
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


def queued_invite(db: Session, recipient: str) -> tuple[PasswordResetToken, str]:
    row = db.query(MailOutbox).filter_by(recipient=recipient).one()
    token = db.get(PasswordResetToken, row.reset_token_id)
    assert token is not None
    return token, decrypt_token(get_settings(), row.encrypted_token)


async def create_account(http: AsyncClient, **body: object):
    return await http.post("/api/v1/admin/users", headers=csrf(http), json=body)


def test_abuse_request_quota(db: Session) -> None:
    key = uuid4().hex
    settings = get_settings()
    assert auth.consume_rate_limit(db, settings, "test-quota", key, limit=2)
    assert auth.consume_rate_limit(db, settings, "test-quota", key, limit=2)
    assert not auth.consume_rate_limit(db, settings, "test-quota", key, limit=2)


@pytest.mark.anyio
async def test_daily_goal_is_per_account_and_requires_authentication_and_csrf(db: Session) -> None:
    first = account(db)
    second = account(db)
    tester = account(db, "tester")
    async with client() as http:
        denied = await http.patch("/api/v1/me/daily-goal", json={"dailyGoal": 40})
        assert denied.status_code == 401
        await login(http, first)
        denied = await http.patch("/api/v1/me/daily-goal", json={"dailyGoal": 40})
        assert denied.status_code == 403
        invalid = await http.patch(
            "/api/v1/me/daily-goal", headers=csrf(http), json={"dailyGoal": 0}
        )
        assert invalid.status_code == 422
        saved = await http.patch(
            "/api/v1/me/daily-goal", headers=csrf(http), json={"dailyGoal": 40}
        )
        assert saved.status_code == 200, saved.text
        assert saved.json()["dailyGoal"] == 40
        assert db.get(User, second.id).daily_goal is None
        cleared = await http.patch(
            "/api/v1/me/daily-goal", headers=csrf(http), json={"dailyGoal": None}
        )
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["dailyGoal"] is None
    async with client() as http:
        await login(http, tester)
        denied = await http.patch(
            "/api/v1/me/daily-goal", headers=csrf(http), json={"dailyGoal": 40}
        )
        assert denied.status_code == 403
        assert db.get(User, tester.id).daily_goal is None


def test_purge_preserves_inactive_accounts_with_real_passwords_and_attempts(db: Session) -> None:
    old = datetime.now(UTC) - timedelta(days=8)
    seeded = account(db)
    cleared_email = account(db)
    disabled_email = account(db)
    disabled_email.email = f"disabled-{uuid4().hex}@example.test"
    for user in (seeded, cleared_email, disabled_email):
        user.is_active = False
        user.created_at = old
        db.add(
            AttemptEvent(
                user_id=user.id,
                event_id=f"retained-{user.id}",
                mode="element-name",
                question_id="H",
                content_version="v1",
                occurred_at=old,
                is_correct=True,
                payload={},
                payload_hash=uuid4().hex,
            )
        )
    db.flush()

    counts = maintenance.purge_expired_state(db, get_settings())
    assert "unverified_accounts" not in counts
    for user in (seeded, cleared_email, disabled_email):
        assert db.get(User, user.id) is not None
        assert db.query(AttemptEvent).filter_by(user_id=user.id).count() == 1


@pytest.mark.anyio
async def test_self_registration_endpoints_are_gone(db: Session) -> None:
    async with client() as http:
        for path in (
            "/api/v1/auth/register",
            "/api/v1/auth/verify-email",
            "/api/v1/auth/verification/request",
        ):
            response = await http.post(
                path, headers={"Origin": ORIGIN}, json={"email": "someone@example.test"}
            )
            assert response.status_code == 404, path


@pytest.mark.anyio
async def test_admin_invitation_password_change_and_reset(db: Session) -> None:
    db.autoflush = False
    admin = account(db, "admin")
    address = f"learner-{uuid4().hex[:10]}@example.test"
    async with client() as http:
        await login(http, admin)
        created = await create_account(
            http, email=address.upper(), displayName="Nový žák", role="user"
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["email"] == address
        assert body["displayName"] == "Nový žák"
        assert body["role"] == "user"
        assert body["isActive"] is True
        assert body["emailVerified"] is True
        assert body["lastLoginAt"] is None
        invite, invite_token = queued_invite(db, address)
        assert invite.purpose == "invite"
        assert invite.token_hash != invite_token
        assert invite.expires_at - datetime.now(UTC) > timedelta(days=6)
        new_account = db.query(User).filter_by(email=address).one()
        assert new_account.password_hash.startswith("$argon2")
    async with client() as http:
        before_invite = await http.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": address, "password": PASSWORD},
        )
        assert before_invite.status_code == 401
        accepted = await http.post(
            "/api/v1/auth/password-reset/confirm",
            headers={"Origin": ORIGIN},
            json={"token": invite_token, "newPassword": PASSWORD},
        )
        assert accepted.status_code == 204, accepted.text
        replay = await http.post(
            "/api/v1/auth/password-reset/confirm",
            headers={"Origin": ORIGIN},
            json={"token": invite_token, "newPassword": PASSWORD},
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
        assert (
            db.query(MailOutbox)
            .filter(MailOutbox.recipient == address, MailOutbox.reset_token_id.is_not(None))
            .count()
            == 1
        )
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
    admin = account(db, "admin")
    async with client() as http:
        await login(http, admin)
        with monkeypatch.context() as patch:
            patch.setattr(
                "inorganic_api.services.accounts.email.require_delivery_config", unavailable
            )
            creation = await create_account(http, email=address, role="user")
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
        assert creation.status_code == recovery.status_code == unknown_recovery.status_code == 503
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
async def test_admin_account_creation_requires_admin_csrf_and_valid_input(db: Session) -> None:
    admin = account(db, "admin")
    learner = account(db)
    existing = account(db)
    existing.email = f"taken-{uuid4().hex[:8]}@example.test"
    db.flush()
    address = f"new-{uuid4().hex[:8]}@example.test"
    async with client() as http:
        anonymous = await http.post(
            "/api/v1/admin/users",
            headers={"Origin": ORIGIN},
            json={"email": address, "role": "user"},
        )
        assert anonymous.status_code == 401
        await login(http, learner)
        assert (await create_account(http, email=address, role="user")).status_code == 403
        await login(http, admin)
        missing_csrf = await http.post(
            "/api/v1/admin/users",
            headers={"Origin": ORIGIN},
            json={"email": address, "role": "user"},
        )
        assert missing_csrf.status_code == 403
        wrong_origin = await http.post(
            "/api/v1/admin/users",
            headers={**csrf(http), "Origin": "https://attacker.example"},
            json={"email": address, "role": "user"},
        )
        assert wrong_origin.status_code == 403
        for invalid in (
            {"email": address, "role": "guest"},
            {"email": address},
            {"email": "not-an-address", "role": "user"},
            {"email": address, "role": "user", "password": PASSWORD},
            {"email": address, "role": "user", "isActive": False},
        ):
            assert (await create_account(http, **invalid)).status_code == 422, invalid
        duplicate = await create_account(http, email=existing.email.upper(), role="admin")
        assert duplicate.status_code == 409
        assert duplicate.json()["error"]["code"] == "email_taken"
        assert db.query(MailOutbox).filter_by(recipient=existing.email).count() == 0
        assert db.query(User).filter_by(email=address).count() == 0
        promoted = await create_account(http, email=address, role="admin")
        assert promoted.status_code == 201, promoted.text
        assert promoted.json()["role"] == "admin"
        assert promoted.json()["displayName"] == address.split("@", 1)[0]


def test_admin_account_creation_is_rate_limited_per_admin(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(accounts, "ADMIN_CREATE_LIMIT", 2)
    settings = get_settings()
    first_admin = account(db, "admin")
    second_admin = account(db, "admin")
    for _ in range(2):
        accounts.admin_create_account(
            db, settings, first_admin, f"a-{uuid4().hex[:8]}@example.test", None, "user"
        )
    with pytest.raises(AppError) as limited:
        accounts.admin_create_account(
            db, settings, first_admin, f"b-{uuid4().hex[:8]}@example.test", None, "user"
        )
    assert limited.value.status_code == 429
    accounts.admin_create_account(
        db, settings, second_admin, f"c-{uuid4().hex[:8]}@example.test", None, "tester"
    )


def test_invitation_mail_is_claimed_with_invite_purpose(db: Session) -> None:
    admin = account(db, "admin")
    address = f"claim-{uuid4().hex[:8]}@example.test"
    accounts.admin_create_account(db, get_settings(), admin, address, None, "user")
    claimed = None
    while (message := mail_outbox.claim_next(db)) is not None:
        if message.recipient == address:
            claimed = message
            break
    assert claimed is not None
    assert claimed.purpose == "invite"


@pytest.mark.anyio
async def test_guest_login_is_disabled_by_default(db: Session) -> None:
    async with client() as http:
        guest = await http.post("/api/v1/auth/guest", headers={"Origin": ORIGIN})
        assert guest.status_code == 404
        assert http.cookies.get(get_settings().session_cookie_name) is None


@pytest.mark.anyio
async def test_guest_session_is_read_only(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "guest_login_enabled", True)
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
