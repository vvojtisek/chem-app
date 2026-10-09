from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from inorganic_api.api.dependencies import require_role
from inorganic_api.config import get_settings
from inorganic_api.errors import ErrorEnvelope
from inorganic_api.services.auth import AuthenticatedSession
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
