from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["inorganic-chemistry-api"]
    timestamp: datetime


router = APIRouter(tags=["system"])


@router.get(
    "/health",
    operation_id="getHealth",
    response_model=HealthResponse,
    summary="Check API process health",
)
def get_health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="inorganic-chemistry-api",
        timestamp=datetime.now(UTC),
    )
