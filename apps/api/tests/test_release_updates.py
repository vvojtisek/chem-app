import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer
from types import SimpleNamespace
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from inorganic_api.api.dependencies import require_csrf
from inorganic_api.api.releases import release_updater_dependency
from inorganic_api.config import Settings
from inorganic_api.database import session_dependency
from inorganic_api.errors import AppError
from inorganic_api.main import app
from inorganic_api.services import release_updates
from inorganic_api.services.release_updates import (
    ReleaseUpdater,
    post_update_request,
    request_release_update,
)

URL = "http://watchtower:8080/v1/update"
TOKEN = "t" * 40


class RecordingPost:
    def __init__(self, outcome: int | Exception = 202) -> None:
        self.outcome = outcome
        self.calls: list[tuple[str, str]] = []

    def __call__(self, url: str, token: str) -> int:
        self.calls.append((url, token))
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


@pytest.mark.parametrize("status", [200, 202])
def test_updater_accepts_watchtower_success(status: int) -> None:
    post = RecordingPost(status)
    ReleaseUpdater(URL, TOKEN, post=post).request_update()
    assert post.calls == [(URL, TOKEN)]


@pytest.mark.parametrize(
    ("outcome", "status_code", "code"),
    [
        (429, 409, "update_in_progress"),
        (401, 503, "update_unavailable"),
        (500, 503, "update_unavailable"),
        (302, 503, "update_unavailable"),
        (OSError("connection refused"), 503, "update_unavailable"),
    ],
)
def test_updater_translates_failures(outcome: int | Exception, status_code: int, code: str) -> None:
    with pytest.raises(AppError) as error:
        ReleaseUpdater(URL, TOKEN, post=RecordingPost(outcome)).request_update()
    assert (error.value.status_code, error.value.code) == (status_code, code)


@pytest.fixture
def watchtower() -> Iterator[tuple[str, list[dict[str, str]]]]:
    requests: list[dict[str, str]] = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802 - http.server naming
            requests.append(
                {"path": self.path, "authorization": self.headers.get("Authorization", "")}
            )
            if self.path.startswith("/redirect/v1/update"):
                self.send_response(307)
                self.send_header("Location", "/elsewhere")
            else:
                self.send_response(202)
            self.end_headers()

        def log_message(self, *_args: object) -> None:
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", requests
    finally:
        server.shutdown()
        server.server_close()


def test_post_sends_bearer_token_and_async_flag(watchtower) -> None:
    base, requests = watchtower
    assert post_update_request(f"{base}/v1/update", TOKEN) == 202
    assert requests == [{"path": "/v1/update?async=true", "authorization": f"Bearer {TOKEN}"}]


def test_post_never_follows_redirects(watchtower) -> None:
    base, requests = watchtower
    assert post_update_request(f"{base}/redirect/v1/update", TOKEN) == 307
    assert [request["path"] for request in requests] == ["/redirect/v1/update?async=true"]


def admin() -> SimpleNamespace:
    return SimpleNamespace(id=uuid4(), role="admin")


def test_service_rejects_non_admins() -> None:
    post = RecordingPost()
    with pytest.raises(AppError) as error:
        request_release_update(
            None,
            Settings(),
            SimpleNamespace(id=uuid4(), role="user"),
            ReleaseUpdater(URL, TOKEN, post),
        )
    assert error.value.status_code == 403
    assert post.calls == []


def test_service_reports_disabled_updates() -> None:
    with pytest.raises(AppError) as error:
        request_release_update(None, Settings(), admin(), None)
    assert (error.value.status_code, error.value.code) == (503, "updates_disabled")


def test_service_rate_limits_before_calling_watchtower(monkeypatch) -> None:
    monkeypatch.setattr(release_updates.auth, "consume_rate_limit", lambda *_a, **_k: False)
    post = RecordingPost()
    with pytest.raises(AppError) as error:
        request_release_update(None, Settings(), admin(), ReleaseUpdater(URL, TOKEN, post))
    assert error.value.status_code == 429
    assert post.calls == []


def test_service_calls_watchtower_within_the_limit(monkeypatch) -> None:
    keys: list[tuple[str, str, int]] = []

    def consume(_db, _settings, kind: str, value: str, *, limit: int) -> bool:
        keys.append((kind, value, limit))
        return True

    monkeypatch.setattr(release_updates.auth, "consume_rate_limit", consume)
    post = RecordingPost()
    request_release_update(None, Settings(), admin(), ReleaseUpdater(URL, TOKEN, post))
    assert keys == [("release-update", "all", release_updates.UPDATE_REQUEST_LIMIT)]
    assert post.calls == [(URL, TOKEN)]


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def overrides(monkeypatch):
    monkeypatch.setattr(release_updates.auth, "consume_rate_limit", lambda *_a, **_k: True)
    app.dependency_overrides[session_dependency] = lambda: None
    yield app.dependency_overrides
    for dependency in (require_csrf, session_dependency, release_updater_dependency):
        app.dependency_overrides.pop(dependency, None)


async def post_update() -> tuple[int, str]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as http:
        response = await http.post("/api/v1/admin/releases/update")
    return response.status_code, response.text


@pytest.mark.anyio
async def test_admin_update_request_is_accepted(overrides) -> None:
    post = RecordingPost()
    overrides[require_csrf] = lambda: SimpleNamespace(user=admin(), session=None)
    overrides[release_updater_dependency] = lambda: ReleaseUpdater(URL, TOKEN, post)

    assert await post_update() == (202, "")
    assert post.calls == [(URL, TOKEN)]


@pytest.mark.anyio
async def test_update_without_csrf_is_rejected_before_watchtower(overrides) -> None:
    post = RecordingPost()
    overrides[release_updater_dependency] = lambda: ReleaseUpdater(URL, TOKEN, post)

    status, _body = await post_update()
    assert status == 401
    assert post.calls == []


def test_update_url_requires_token_and_valid_shape() -> None:
    assert (
        Settings(watchtower_update_url=URL, watchtower_http_api_token=TOKEN).watchtower_update_url
        == URL
    )
    assert (
        Settings(watchtower_update_url="", watchtower_http_api_token="").watchtower_update_url
        is None
    )
    with pytest.raises(ValidationError, match="WATCHTOWER_HTTP_API_TOKEN"):
        Settings(watchtower_update_url=URL)
    with pytest.raises(ValidationError):
        Settings(
            watchtower_update_url="http://watchtower:8080/v1/update?x=1",
            watchtower_http_api_token=TOKEN,
        )
    with pytest.raises(ValidationError):
        Settings(watchtower_update_url="file:///etc/passwd", watchtower_http_api_token=TOKEN)
