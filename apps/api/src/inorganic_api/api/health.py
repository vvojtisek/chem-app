import logging
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from inorganic_api.database import session_dependency
from inorganic_api.errors import AppError, ErrorEnvelope
from inorganic_api.repositories.schema import get_schema_revision
from inorganic_api.services.schema_version import is_schema_ready

logger = logging.getLogger(__name__)


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
    unavailable = AppError(503, "unavailable", "Service is temporarily unavailable.")
    try:
        revision = get_schema_revision(db)
    except SQLAlchemyError as exc:
        raise unavailable from exc
    if not is_schema_ready(revision):
        logger.warning("Database schema revision %s is behind this release", revision)
        raise unavailable
    return get_health()
