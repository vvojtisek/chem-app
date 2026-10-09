"""Read and write curriculum files in the repository through the GitHub REST API (ADR 0014).

The token can push branches and open pull requests, so this adapter only ever
writes to the dedicated curation branch and never to the base branch. Merging
into ``main`` stays a human action protected by branch protection.
"""

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from inorganic_api.errors import AppError

logger = logging.getLogger(__name__)

API_ROOT = "https://api.github.com"
REQUEST_TIMEOUT_SECONDS = 10
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
MAX_FILE_BYTES = 1024 * 1024

Send = Callable[[str, str, dict[str, Any] | None, str], tuple[int, bytes]]


class _RejectRedirects(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect, so the token is sent only to api.github.com."""

    def redirect_request(self, *_args: object, **_kwargs: object) -> None:
        return None


_opener = urllib.request.build_opener(_RejectRedirects)


def send_request(
    method: str, url: str, body: dict[str, Any] | None, token: str
) -> tuple[int, bytes]:
    request = urllib.request.Request(
        url,
        data=None if body is None else json.dumps(body).encode(),
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "inorganic-chemistry-api",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with _opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.status, response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(MAX_RESPONSE_BYTES + 1)


@dataclass(frozen=True)
class RepositoryFile:
    text: str
    sha: str


class FileChangedError(Exception):
    """The file on the branch no longer has the expected blob SHA."""


class CurriculumRepository:
    def __init__(self, repository: str, token: str, send: Send = send_request) -> None:
        self._repository = repository
        self._token = token
        self._send = send
        self._owner = repository.split("/", 1)[0]

    def _call(
        self, method: str, path: str, body: dict[str, Any] | None = None, *, ok: tuple[int, ...]
    ) -> tuple[int, Any]:
        url = f"{API_ROOT}/repos/{self._repository}{path}"
        try:
            status, payload = self._send(method, url, body, self._token)
        except (OSError, ValueError) as exc:
            logger.warning("GitHub request %s %s failed: %s", method, path, type(exc).__name__)
            raise _unavailable() from exc
        if len(payload) > MAX_RESPONSE_BYTES:
            logger.warning("GitHub response for %s %s was too large", method, path)
            raise _unavailable()
        if status not in ok:
            logger.warning("GitHub request %s %s returned HTTP %s", method, path, status)
            raise _unavailable()
        try:
            data = json.loads(payload) if payload else None
        except ValueError as exc:
            raise _unavailable() from exc
        return status, data

    def branch_sha(self, branch: str) -> str:
        _, data = self._call("GET", f"/git/ref/heads/{_quote(branch)}", ok=(200,))
        return _require_str(data, "object", "sha")

    def branch_exists(self, branch: str) -> bool:
        status, _ = self._call("GET", f"/git/ref/heads/{_quote(branch)}", ok=(200, 404))
        return status == 200

    def reset_branch(self, branch: str, sha: str) -> None:
        """Create the branch at ``sha``, or move an existing branch there."""
        if self.branch_exists(branch):
            self._call(
                "PATCH",
                f"/git/refs/heads/{_quote(branch)}",
                {"sha": sha, "force": True},
                ok=(200,),
            )
        else:
            self._call("POST", "/git/refs", {"ref": f"refs/heads/{branch}", "sha": sha}, ok=(201,))

    def open_pull_request_url(self, branch: str, base: str) -> str | None:
        query = urllib.parse.urlencode(
            {"head": f"{self._owner}:{branch}", "base": base, "state": "open"}
        )
        _, data = self._call("GET", f"/pulls?{query}", ok=(200,))
        if not isinstance(data, list) or not data:
            return None
        return _require_str(data[0], "html_url")

    def create_pull_request(self, branch: str, base: str, title: str, body: str) -> str:
        _, data = self._call(
            "POST",
            "/pulls",
            {"title": title, "head": branch, "base": base, "body": body},
            ok=(201,),
        )
        return _require_str(data, "html_url")

    def read_file(self, path: str, branch: str) -> RepositoryFile:
        query = urllib.parse.urlencode({"ref": branch})
        _, data = self._call("GET", f"/contents/{_quote(path)}?{query}", ok=(200,))
        if not isinstance(data, dict) or data.get("encoding") != "base64":
            raise _unavailable()
        content = data.get("content")
        if not isinstance(content, str):
            raise _unavailable()
        raw = base64.b64decode(content)
        if len(raw) > MAX_FILE_BYTES:
            raise _unavailable()
        return RepositoryFile(text=raw.decode("utf-8"), sha=_require_str(data, "sha"))

    def write_file(self, path: str, branch: str, text: str, expected_sha: str, message: str) -> str:
        """Commit ``text`` to ``path`` and return the new blob SHA.

        GitHub rejects the write with 409 when the file no longer has ``expected_sha``.
        """
        encoded = text.encode("utf-8")
        if len(encoded) > MAX_FILE_BYTES:
            raise AppError(413, "curriculum_file_too_large", "The dataset file is too large.")
        body = {
            "message": message,
            "content": base64.b64encode(encoded).decode("ascii"),
            "sha": expected_sha,
            "branch": branch,
        }
        status, data = self._call("PUT", f"/contents/{_quote(path)}", body, ok=(200, 201, 409))
        if status == 409:
            raise FileChangedError
        return _require_str(data, "content", "sha")


def _quote(value: str) -> str:
    return urllib.parse.quote(value, safe="/")


def _require_str(data: object, *keys: str) -> str:
    for key in keys:
        if not isinstance(data, dict):
            raise _unavailable()
        data = data.get(key)
    if not isinstance(data, str) or not data:
        raise _unavailable()
    return data


def _unavailable() -> AppError:
    return AppError(
        503, "curriculum_repository_unavailable", "The content repository is unavailable."
    )
