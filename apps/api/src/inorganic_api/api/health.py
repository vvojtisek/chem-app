from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from inorganic_api.database import session_dependency
from inorganic_api.errors import AppError, ErrorEnvelope


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


@router.get(
    "/health/ready",
    operation_id="getHealthReady",
    response_model=HealthResponse,
    responses={503: {"model": ErrorEnvelope}},
    summary="Check API database readiness",
)
def get_health_ready(db: Annotated[Session, Depends(session_dependency)]) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise AppError(503, "unavailable", "Service is temporarily unavailable.") from exc
    return get_health()
