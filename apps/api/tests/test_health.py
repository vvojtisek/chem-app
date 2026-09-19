import pytest
from httpx import ASGITransport, AsyncClient

from inorganic_api.main import app


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
