from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from httpx import ASGITransport, AsyncClient

from inorganic_api.database import session_dependency
from inorganic_api.main import app
from inorganic_api.services.schema_version import MIGRATION_REVISIONS, is_schema_ready


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_health_endpoint() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "inorganic-chemistry-api"
    assert response.json()["timestamp"].endswith("Z")


@pytest.mark.anyio
async def test_openapi_has_stable_health_operation_id() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/openapi.json")

    assert response.status_code == 200
    operation = response.json()["paths"]["/api/v1/health"]["get"]
    assert operation["operationId"] == "getHealth"


API_DIR = Path(__file__).resolve().parents[1]


def test_migration_revisions_match_alembic_history() -> None:
    config = Config()
    config.set_main_option("script_location", str(API_DIR / "migrations"))
    history = [script.revision for script in ScriptDirectory.from_config(config).walk_revisions()]

    assert tuple(reversed(history)) == MIGRATION_REVISIONS


@pytest.mark.parametrize(
    ("revision", "ready"),
    [
        (MIGRATION_REVISIONS[-1], True),
        ("9999_from_a_newer_release", True),
        (MIGRATION_REVISIONS[-2], False),
        (None, False),
    ],
)
def test_schema_readiness_rejects_only_a_database_behind_the_code(
    revision: str | None, ready: bool
) -> None:
    assert is_schema_ready(revision) is ready


class _RevisionResult:
    def __init__(self, revision: str | None) -> None:
        self._revision = revision

    def scalar_one_or_none(self) -> str | None:
        return self._revision


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("revision", "status_code"),
    [(MIGRATION_REVISIONS[-1], 200), (MIGRATION_REVISIONS[0], 503), (None, 503)],
)
async def test_readiness_reports_schema_state(revision: str | None, status_code: int) -> None:
    class Database:
        def execute(self, _statement):
            return _RevisionResult(revision)

    app.dependency_overrides[session_dependency] = lambda: Database()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.get("/api/v1/health/ready")
    finally:
        app.dependency_overrides.pop(session_dependency, None)

    assert response.status_code == status_code
    if status_code == 503:
        assert response.json()["error"]["code"] == "unavailable"
