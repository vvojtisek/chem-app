from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from inorganic_api.api.attempt_schemas import (
    AdminUserPage,
    AttemptPage,
    AttemptStats,
    BatchRequest,
    BatchResponse,
    Progression,
)
from inorganic_api.api.dependencies import get_current_user, require_csrf, require_role
from inorganic_api.database import session_dependency
from inorganic_api.errors import ErrorEnvelope
from inorganic_api.services import attempts
from inorganic_api.services.auth import AuthenticatedSession

router = APIRouter(tags=["attempts"])

READ_ERRORS = {
    400: {"model": ErrorEnvelope},
    401: {"model": ErrorEnvelope},
    422: {"model": ErrorEnvelope},
}
WRITE_ERRORS = {
    400: {"model": ErrorEnvelope},
    401: {"model": ErrorEnvelope},
    403: {"model": ErrorEnvelope},
    409: {"model": ErrorEnvelope},
    422: {"model": ErrorEnvelope},
}
ADMIN_ERRORS = {**READ_ERRORS, 403: {"model": ErrorEnvelope}, 404: {"model": ErrorEnvelope}}


@router.post(
    "/me/attempt-events/batch",
    operation_id="uploadAttemptEvents",
    response_model=BatchResponse,
    responses=WRITE_ERRORS,
)
def upload_attempt_events(
    body: BatchRequest,
    current: Annotated[AuthenticatedSession, Depends(require_csrf)],
    db: Annotated[Session, Depends(session_dependency)],
) -> BatchResponse:
    return attempts.add_batch(db, current.user, body.events)


@router.get(
    "/me/attempt-events",
    operation_id="listMyAttemptEvents",
    response_model=AttemptPage,
    responses=READ_ERRORS,
)
def list_my_attempt_events(
    current: Annotated[AuthenticatedSession, Depends(get_current_user)],
    db: Annotated[Session, Depends(session_dependency)],
    cursor: Annotated[str | None, Query(max_length=128)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> AttemptPage:
    return attempts.list_events(db, current.user, current.user.id, cursor, limit)


@router.get(
    "/me/stats",
    operation_id="getMyStats",
    response_model=AttemptStats,
    responses=READ_ERRORS,
)
def my_stats(
    current: Annotated[AuthenticatedSession, Depends(get_current_user)],
    db: Annotated[Session, Depends(session_dependency)],
) -> AttemptStats:
    return attempts.stats(db, current.user, current.user.id)


@router.get(
    "/me/progression",
    operation_id="getMyProgression",
    response_model=Progression,
    responses={**READ_ERRORS, 403: {"model": ErrorEnvelope}},
)
def my_progression(
    current: Annotated[AuthenticatedSession, Depends(get_current_user)],
    db: Annotated[Session, Depends(session_dependency)],
) -> Progression:
    return attempts.progression(db, current.user)


@router.get(
    "/admin/users",
    operation_id="listAdminUsers",
    response_model=AdminUserPage,
    responses=ADMIN_ERRORS,
)
def list_admin_users(
    current: Annotated[AuthenticatedSession, Depends(require_role("admin"))],
    db: Annotated[Session, Depends(session_dependency)],
    cursor: Annotated[str | None, Query(max_length=128)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AdminUserPage:
    return attempts.users_page(db, current.user, cursor, limit)


@router.get(
    "/admin/stats",
    operation_id="getAdminStats",
    response_model=AttemptStats,
    responses=ADMIN_ERRORS,
)
def admin_stats(
    current: Annotated[AuthenticatedSession, Depends(require_role("admin"))],
    db: Annotated[Session, Depends(session_dependency)],
) -> AttemptStats:
    return attempts.stats(db, current.user)


@router.get(
    "/admin/users/{user_id}/attempt-events",
    operation_id="listUserAttemptEvents",
    response_model=AttemptPage,
    responses=ADMIN_ERRORS,
)
def list_user_attempt_events(
    user_id: UUID,
    current: Annotated[AuthenticatedSession, Depends(require_role("admin"))],
    db: Annotated[Session, Depends(session_dependency)],
    cursor: Annotated[str | None, Query(max_length=128)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> AttemptPage:
    return attempts.list_events(db, current.user, user_id, cursor, limit)
