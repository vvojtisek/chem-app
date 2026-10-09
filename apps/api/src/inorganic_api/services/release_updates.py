"""Ask Watchtower to apply the published ``stable`` images (ADR 0012).

Watchtower decides what runs: it pulls whatever CI tagged ``stable`` for the
labelled containers. This module only forwards an administrator's request to
its token-protected update endpoint, which is reachable on ``update-net``.
"""

import logging
import urllib.error
import urllib.request
from collections.abc import Callable

from sqlalchemy.orm import Session

from inorganic_api.config import Settings
from inorganic_api.errors import AppError
from inorganic_api.models import User
from inorganic_api.services import auth

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 5
UPDATE_REQUEST_LIMIT = 3

Post = Callable[[str, str], int]


class _RejectRedirects(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect, so the bearer token is sent only to the configured URL."""

    def redirect_request(self, *_args: object, **_kwargs: object) -> None:
        return None


_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _RejectRedirects)


def post_update_request(url: str, token: str) -> int:
    request = urllib.request.Request(
        f"{url}?async=true",
        data=b"",
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with _opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code


class ReleaseUpdater:
    def __init__(self, url: str, token: str, post: Post = post_update_request) -> None:
        self._url = url
        self._token = token
        self._post = post

    def request_update(self) -> None:
        try:
            status = self._post(self._url, self._token)
        except (OSError, ValueError) as exc:
            logger.warning("Watchtower update request failed: %s", type(exc).__name__)
            raise _unavailable() from exc
        if status == 429:
            raise AppError(409, "update_in_progress", "An update is already running.")
        if status not in (200, 202):
            logger.warning("Watchtower rejected the update request with HTTP %s", status)
            raise _unavailable()


def _unavailable() -> AppError:
    return AppError(503, "update_unavailable", "The update service is unavailable.")


def request_release_update(
    db: Session, settings: Settings, actor: User, updater: ReleaseUpdater | None
) -> None:
    if actor.role != "admin":
        raise AppError(403, "forbidden", "Access denied.")
    if updater is None:
        raise AppError(503, "updates_disabled", "Updates from the application are disabled.")
    if not auth.consume_rate_limit(
        db, settings, "release-update", "all", limit=UPDATE_REQUEST_LIMIT
    ):
        raise AppError(429, "too_many_attempts", "Too many requests. Try again later.")
    logger.warning("Administrator %s requested a release update", actor.id)
    updater.request_update()
