import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from inorganic_api.database import session_dependency
from inorganic_api.main import app
from inorganic_api.models import AttemptEvent, User
from inorganic_api.services import attempts
from inorganic_api.services.passwords import hash_password

API_DIR = Path(__file__).resolve().parents[1]
ORIGIN = "http://localhost:3000"
PASSWORD = "correct-horse-battery-staple"


@pytest.fixture(scope="module")
def engine():
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    database_name = make_url(database_url).database or ""
    if not (database_name.startswith("test_") or database_name.endswith("_test")):
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
def accounts(db: Session) -> dict[str, User]:
    result = {}
    for role in ("admin", "user", "tester"):
        account = User(
            id=uuid4(),
            username=f"{role}_{uuid4().hex[:12]}",
            password_hash=hash_password(PASSWORD),
            role=role,
        )
        db.add(account)
        result[role] = account
    db.flush()
    return result


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver")


async def login(http: AsyncClient, account: User) -> None:
    response = await http.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"username": account.username, "password": PASSWORD},
    )
    assert response.status_code == 200, response.text


async def upload(http: AsyncClient, events: list[dict]):
    return await http.post(
        "/api/v1/me/attempt-events/batch",
        headers={"Origin": ORIGIN, "X-CSRF-Token": http.cookies["__Host-inorganic_csrf"]},
        json={"events": events},
    )


def event(event_id: str, **changes) -> dict:
    return {
        "id": event_id,
        "questionId": "element.001-h",
        "contentVersion": "2026-09-23",
        "occurredAt": "2026-09-23T10:00:00Z",
        "isCorrect": True,
        "round": "initial",
        "mode": "periodic-table",
        "direction": "name-to-symbol",
        "matchPolicy": "symbol-exact",
        **changes,
    }


@pytest.mark.anyio
async def test_batch_idempotence_conflict_and_atomicity(
    db: Session, accounts: dict[str, User]
) -> None:
    async with client() as http:
        await login(http, accounts["user"])
        first = await upload(http, [event("one"), event("two")])
        assert first.status_code == 200, first.text
        assert first.json() == {"accepted": ["one", "two"], "duplicates": [], "rejected": []}
        repeat = await upload(http, [event("one")])
        assert repeat.json() == {"accepted": [], "duplicates": ["one"], "rejected": []}
        conflicting = await upload(http, [event("three"), event("one", isCorrect=False)])
        assert conflicting.status_code == 200
        assert conflicting.json() == {
            "accepted": ["three"],
            "duplicates": [],
            "rejected": [
                {
                    "index": 1,
                    "eventId": "one",
                    "code": "idempotency_conflict",
                    "message": "This event ID was already used with different content.",
                }
            ],
        }
        assert {row.event_id for row in db.scalars(select(AttemptEvent))} == {
            "one",
            "two",
            "three",
        }


@pytest.mark.anyio
async def test_daily_quota_keeps_duplicates_free_and_rejects_only_new_events(
    db: Session, accounts: dict[str, User], monkeypatch: pytest.MonkeyPatch
) -> None:
    assert attempts.MAX_DAILY_ATTEMPTS_PER_USER >= 5_000
    monkeypatch.setattr(attempts, "MAX_DAILY_ATTEMPTS_PER_USER", 2)
    async with client() as http:
        await login(http, accounts["user"])
        first = await upload(http, [event("quota-1"), event("quota-2"), event("quota-3")])
        assert first.status_code == 200, first.text
        assert first.json()["accepted"] == ["quota-1", "quota-2"]
        assert first.json()["rejected"][0]["code"] == "quota_exceeded"
        assert first.json()["rejected"][0]["eventId"] == "quota-3"
        duplicate = await upload(http, [event("quota-1"), event("quota-3")])
        assert duplicate.json()["duplicates"] == ["quota-1"]
        assert duplicate.json()["rejected"][0]["code"] == "quota_exceeded"
        assert db.query(AttemptEvent).filter_by(user_id=accounts["user"].id).count() == 2


@pytest.mark.anyio
async def test_validation_limits_and_csrf(db: Session, accounts: dict[str, User]) -> None:
    async with client() as http:
        await login(http, accounts["user"])
        for invalid in ([], [event(str(index)) for index in range(201)]):
            response = await upload(http, invalid)
            assert response.status_code == 422
            assert response.json()["error"]["code"] == "validation_error"
        for invalid in (
            [event("bad", role="admin")],
            [event("bad", matchPolicy="exact-position")],
            [event("bad", occurredAt="2026-09-23T10:00:00")],
            [event("bad", id="a" * 129)],
            [
                event(
                    "bad",
                    mode="nomenclature",
                    direction="name-to-formula",
                    matchPolicy="name-lenient",
                    eventSchemaVersion=1,
                    sessionId="session-1",
                    sequence=0,
                    compoundId="compound-1",
                    outcome="correct",
                    match="canonical",
                )
            ],
            [
                event(
                    "bad-equation",
                    mode="equation",
                    direction="complete-equation",
                    matchPolicy="approved-balanced",
                    eventSchemaVersion=1,
                    sessionId="equation-session-1",
                    sequence=0,
                    level="beginner",
                )
            ],
        ):
            response = await upload(http, invalid)
            assert response.status_code == 200
            assert response.json()["accepted"] == []
            assert response.json()["rejected"][0]["index"] == 0
            assert response.json()["rejected"][0]["code"] == "validation_error"
        without_csrf = await http.post(
            "/api/v1/me/attempt-events/batch",
            headers={"Origin": ORIGIN},
            json={"events": [event("one")]},
        )
        assert without_csrf.status_code == 403
        assert (await http.get("/api/v1/me/stats")).json()["totalAttempts"] == 0


@pytest.mark.anyio
async def test_all_attempt_modes_are_accepted(db: Session, accounts: dict[str, User]) -> None:
    async with client() as http:
        await login(http, accounts["user"])
        result = await upload(
            http,
            [
                event("periodic"),
                event(
                    "element",
                    mode="element-name",
                    direction="symbol-to-name",
                    matchPolicy="diacritics-tolerant",
                ),
                event(
                    "nomenclature",
                    mode="nomenclature",
                    direction="name-to-formula",
                    matchPolicy="formula-canonical",
                    eventSchemaVersion=1,
                    sessionId="session-1",
                    sequence=0,
                    compoundId="compound-1",
                    outcome="correct",
                    match="canonical",
                ),
                event(
                    "equation",
                    mode="equation",
                    direction="coefficients",
                    matchPolicy="approved-balanced",
                    eventSchemaVersion=1,
                    sessionId="equation-session-1",
                    sequence=0,
                    level="beginner",
                    questionId="preparation-production.route.vodik-id-20-1-preparation",
                ),
            ],
        )
        assert result.status_code == 200, result.text
        stats = (await http.get("/api/v1/me/stats")).json()
        assert stats["totalAttempts"] == stats["correctAttempts"] == 4
        assert {item["mode"] for item in stats["byMode"]} == {
            "element-name",
            "periodic-table",
            "nomenclature",
            "equation",
        }


@pytest.mark.anyio
async def test_user_scoping_paging_and_roles(db: Session, accounts: dict[str, User]) -> None:
    async with client() as learner, client() as tester, client() as admin:
        await login(learner, accounts["user"])
        await login(tester, accounts["tester"])
        await login(admin, accounts["admin"])
        assert (
            await upload(learner, [event("one"), event("two"), event("three")])
        ).status_code == 200
        assert (await upload(tester, [event("one", isCorrect=False)])).status_code == 200
        page = (await learner.get("/api/v1/me/attempt-events", params={"limit": 2})).json()
        assert [item["event"]["id"] for item in page["items"]] == ["one", "two"]
        assert page["nextCursor"]
        last = (
            await learner.get(
                "/api/v1/me/attempt-events", params={"limit": 2, "cursor": page["nextCursor"]}
            )
        ).json()
        assert [item["event"]["id"] for item in last["items"]] == ["three"]
        assert last["nextCursor"]
        empty = (
            await learner.get(
                "/api/v1/me/attempt-events", params={"limit": 2, "cursor": last["nextCursor"]}
            )
        ).json()
        assert empty == {"items": [], "nextCursor": None}
        assert [
            item["event"]["id"]
            for item in (await tester.get("/api/v1/me/attempt-events")).json()["items"]
        ] == ["one"]
        assert (await learner.get("/api/v1/me/stats")).json()["totalAttempts"] == 3
        assert (await tester.get("/api/v1/me/stats")).json()["totalAttempts"] == 1
        for http in (learner, tester):
            for path in (
                "/api/v1/admin/users",
                "/api/v1/admin/stats",
                f"/api/v1/admin/users/{accounts['user'].id}/attempt-events",
            ):
                denied = await http.get(path)
                assert denied.status_code == 403
                assert denied.json()["error"]["code"] == "forbidden"
        admin_history = await admin.get(
            f"/api/v1/admin/users/{accounts['tester'].id}/attempt-events"
        )
        assert [item["event"]["id"] for item in admin_history.json()["items"]] == ["one"]
        admin_stats = (await admin.get("/api/v1/admin/stats")).json()
        assert admin_stats["totalAttempts"] == admin_stats["correctAttempts"] == 3
        users = (await admin.get("/api/v1/admin/users", params={"limit": 2})).json()
        assert len(users["items"]) == 2
        assert users["nextCursor"]
        second = (
            await admin.get("/api/v1/admin/users", params={"cursor": users["nextCursor"]})
        ).json()
        assert len(second["items"]) == 1


@pytest.mark.anyio
async def test_bad_cursors_and_bounds(db: Session, accounts: dict[str, User]) -> None:
    async with client() as http:
        await login(http, accounts["admin"])
        for path in ("/api/v1/me/attempt-events", "/api/v1/admin/users"):
            response = await http.get(path, params={"cursor": "not-base64!"})
            assert response.status_code == 400
            assert response.json()["error"]["code"] == "invalid_cursor"
        assert (
            await http.get("/api/v1/me/attempt-events", params={"limit": 501})
        ).status_code == 422
        assert (await http.get("/api/v1/admin/users", params={"limit": 101})).status_code == 422
        unknown = await http.get(f"/api/v1/admin/users/{uuid4()}/attempt-events")
        assert unknown.status_code == 404


def test_openapi_attempt_contracts() -> None:
    schema = app.openapi()
    paths = schema["paths"]
    for path, method in (
        ("/api/v1/me/attempt-events/batch", "post"),
        ("/api/v1/me/attempt-events", "get"),
        ("/api/v1/me/stats", "get"),
        ("/api/v1/admin/users", "get"),
        ("/api/v1/admin/stats", "get"),
        ("/api/v1/admin/users/{user_id}/attempt-events", "get"),
    ):
        operation = paths[path][method]
        assert operation["security"] == [{"InorganicSessionCookie": []}]
        assert (
            operation["responses"]["401"]["content"]["application/json"]["schema"]["$ref"]
            == "#/components/schemas/ErrorEnvelope"
        )
        assert (
            operation["responses"]["422"]["content"]["application/json"]["schema"]["$ref"]
            == "#/components/schemas/ErrorEnvelope"
        )
    item = schema["components"]["schemas"]["BatchRequest"]["properties"]["events"]["items"]
    assert item["discriminator"]["propertyName"] == "mode"
    assert {reference["$ref"] for reference in item["oneOf"]} == {
        f"#/components/schemas/{name}"
        for name in (
            "ElementNameAttempt",
            "PeriodicTableAttempt",
            "NomenclatureAttempt",
            "EquationAttempt",
        )
    }
