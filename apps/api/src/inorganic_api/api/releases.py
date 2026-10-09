from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy.orm import Session

from inorganic_api.api.dependencies import require_csrf, require_role
from inorganic_api.config import get_settings
from inorganic_api.database import session_dependency
from inorganic_api.errors import ErrorEnvelope
from inorganic_api.services.auth import AuthenticatedSession
from inorganic_api.services.release_updates import ReleaseUpdater, request_release_update
from inorganic_api.services.releases import LatestReleaseChecker


class LatestReleaseResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    latest_version: str | None
    release_url: str | None


router = APIRouter(tags=["system"])


@lru_cache
def _checker_for(repository: str) -> LatestReleaseChecker:
    return LatestReleaseChecker(repository)


def release_checker_dependency() -> LatestReleaseChecker | None:
    repository = get_settings().release_check_repository
    return None if repository is None else _checker_for(repository)


@router.get(
    "/admin/releases/latest",
    operation_id="getLatestRelease",
    response_model=LatestReleaseResponse,
    responses={401: {"model": ErrorEnvelope}, 403: {"model": ErrorEnvelope}},
    summary="Show the latest published release to administrators",
)
def get_latest_release(
    _current: Annotated[AuthenticatedSession, Depends(require_role("admin"))],
    checker: Annotated[LatestReleaseChecker | None, Depends(release_checker_dependency)],
) -> LatestReleaseResponse:
    release = None if checker is None else checker.latest()
    if release is None:
        return LatestReleaseResponse(latest_version=None, release_url=None)
    return LatestReleaseResponse(latest_version=release.version, release_url=release.url)


def release_updater_dependency() -> ReleaseUpdater | None:
    settings = get_settings()
    if settings.watchtower_update_url is None or settings.watchtower_http_api_token is None:
        return None
    return ReleaseUpdater(settings.watchtower_update_url, settings.watchtower_http_api_token)


@router.post(
    "/admin/releases/update",
    operation_id="applyLatestRelease",
    status_code=202,
    response_class=Response,
    responses={
        401: {"model": ErrorEnvelope},
        403: {"model": ErrorEnvelope},
        409: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
    summary="Ask the server to apply the latest published release",
)
def apply_latest_release(
    current: Annotated[AuthenticatedSession, Depends(require_csrf)],
    db: Annotated[Session, Depends(session_dependency)],
    updater: Annotated[ReleaseUpdater | None, Depends(release_updater_dependency)],
) -> Response:
    request_release_update(db, get_settings(), current.user, updater)
    return Response(status_code=202)
