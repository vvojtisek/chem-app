import json
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from inorganic_api.api.dependencies import get_current_user
from inorganic_api.api.releases import release_checker_dependency, release_updater_dependency
from inorganic_api.config import Settings
from inorganic_api.errors import AppError
from inorganic_api.main import app
from inorganic_api.services.release_updates import ReleaseUpdater
from inorganic_api.services.releases import (
    FAILURE_TTL_SECONDS,
    MAX_RESPONSE_BYTES,
    SUCCESS_TTL_SECONDS,
    LatestRelease,
    LatestReleaseChecker,
    parse_latest_release,
)

REPOSITORY = "vvojtisek/chem-app"


def release_payload(**changes) -> bytes:
    data = {
        "tag_name": "v1.2.0",
        "html_url": f"https://github.com/{REPOSITORY}/releases/tag/v1.2.0",
        "draft": False,
        "prerelease": False,
        **changes,
    }
    return json.dumps(data).encode()


def test_parse_accepts_a_published_semver_release() -> None:
    assert parse_latest_release(REPOSITORY, release_payload()) == LatestRelease(
        version="1.2.0", url=f"https://github.com/{REPOSITORY}/releases/tag/v1.2.0"
    )


@pytest.mark.parametrize(
    "payload",
    [
        release_payload(tag_name="1.2.0"),
        release_payload(tag_name="v1.2"),
        release_payload(tag_name="v01.2.0"),
        release_payload(tag_name="v1.2.0-rc.1"),
        release_payload(html_url="https://evil.example/releases/tag/v1.2.0"),
        release_payload(html_url="javascript:alert(1)"),
        release_payload(html_url="https://github.com/other/repo/releases/tag/v1.2.0"),
        release_payload(draft=True),
        release_payload(prerelease=True),
        release_payload(tag_name=None),
        b"not json",
        b"[]",
        b" " * (MAX_RESPONSE_BYTES + 1),
    ],
)
def test_parse_rejects_unexpected_payloads(payload: bytes) -> None:
    assert parse_latest_release(REPOSITORY, payload) is None


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_checker_caches_success_and_keeps_last_release_after_failure() -> None:
    clock = FakeClock()
    responses: list[bytes | Exception] = [release_payload(), OSError("offline")]
    urls: list[str] = []

    def fetch(url: str) -> bytes:
        urls.append(url)
        response = responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    checker = LatestReleaseChecker(REPOSITORY, fetch=fetch, clock=clock)
    first = checker.latest()
    assert first is not None and first.version == "1.2.0"
    assert checker.latest() == first
    assert urls == [f"https://api.github.com/repos/{REPOSITORY}/releases/latest"]

    clock.now = SUCCESS_TTL_SECONDS
    assert checker.latest() == first
    assert len(urls) == 2

    clock.now = SUCCESS_TTL_SECONDS + FAILURE_TTL_SECONDS - 1
    assert checker.latest() == first
    assert len(urls) == 2


def test_checker_picks_up_a_newer_release_within_five_minutes() -> None:
    clock = FakeClock()
    payloads = [
        release_payload(),
        release_payload(
            tag_name="v1.3.0",
            html_url=f"https://github.com/{REPOSITORY}/releases/tag/v1.3.0",
        ),
    ]
    checker = LatestReleaseChecker(REPOSITORY, fetch=lambda _url: payloads.pop(0), clock=clock)

    assert checker.latest() == LatestRelease(
        version="1.2.0", url=f"https://github.com/{REPOSITORY}/releases/tag/v1.2.0"
    )
    assert SUCCESS_TTL_SECONDS <= 5 * 60
    clock.now = SUCCESS_TTL_SECONDS
    assert checker.latest() == LatestRelease(
        version="1.3.0", url=f"https://github.com/{REPOSITORY}/releases/tag/v1.3.0"
    )


def test_checker_returns_none_when_never_successful() -> None:
    def fetch(_url: str) -> bytes:
        raise OSError("offline")

    assert LatestReleaseChecker(REPOSITORY, fetch=fetch, clock=FakeClock()).latest() is None


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class StaticChecker:
    def __init__(self, release: LatestRelease | None) -> None:
        self.release = release

    def latest(self) -> LatestRelease | None:
        return self.release


def signed_in_as(role: str):
    def dependency() -> SimpleNamespace:
        return SimpleNamespace(user=SimpleNamespace(role=role), session=None)

    return dependency


def signed_out() -> None:
    raise AppError(401, "unauthenticated", "Authentication required.")


@pytest.fixture
def overrides():
    yield app.dependency_overrides
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(release_checker_dependency, None)
    app.dependency_overrides.pop(release_updater_dependency, None)


async def get_latest() -> tuple[int, dict]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as http:
        response = await http.get("/api/v1/admin/releases/latest")
    return response.status_code, response.json()


@pytest.mark.anyio
async def test_admin_sees_latest_release(overrides) -> None:
    release = LatestRelease("1.2.0", f"https://github.com/{REPOSITORY}/releases/tag/v1.2.0")
    overrides[get_current_user] = signed_in_as("admin")
    overrides[release_checker_dependency] = lambda: StaticChecker(release)
    overrides[release_updater_dependency] = lambda: ReleaseUpdater(
        "http://watchtower:8080/v1/update", "test-token"
    )

    assert await get_latest() == (
        200,
        {"latestVersion": "1.2.0", "releaseUrl": release.url, "updatesEnabled": True},
    )


@pytest.mark.anyio
async def test_admin_sees_newer_release_when_updates_are_disabled(overrides) -> None:
    release = LatestRelease("1.2.0", f"https://github.com/{REPOSITORY}/releases/tag/v1.2.0")
    overrides[get_current_user] = signed_in_as("admin")
    overrides[release_checker_dependency] = lambda: StaticChecker(release)
    overrides[release_updater_dependency] = lambda: None

    assert await get_latest() == (
        200,
        {"latestVersion": "1.2.0", "releaseUrl": release.url, "updatesEnabled": False},
    )


@pytest.mark.anyio
async def test_admin_gets_empty_answer_when_check_is_disabled(overrides) -> None:
    overrides[get_current_user] = signed_in_as("admin")
    overrides[release_checker_dependency] = lambda: None
    overrides[release_updater_dependency] = lambda: None

    assert await get_latest() == (
        200,
        {"latestVersion": None, "releaseUrl": None, "updatesEnabled": False},
    )


@pytest.mark.anyio
@pytest.mark.parametrize("role", ["user", "tester", "guest"])
async def test_non_admins_are_forbidden(overrides, role: str) -> None:
    overrides[get_current_user] = signed_in_as(role)
    overrides[release_checker_dependency] = lambda: StaticChecker(None)

    status, body = await get_latest()
    assert status == 403
    assert body["error"]["code"] == "forbidden"


@pytest.mark.anyio
async def test_anonymous_requests_are_rejected(overrides) -> None:
    overrides[get_current_user] = signed_out
    overrides[release_checker_dependency] = lambda: StaticChecker(None)

    status, _body = await get_latest()
    assert status == 401


def test_release_check_repository_setting_is_validated() -> None:
    assert Settings(release_check_repository=REPOSITORY).release_check_repository == REPOSITORY
    with pytest.raises(ValidationError):
        Settings(release_check_repository="https://evil.example/x")
    with pytest.raises(ValidationError):
        Settings(release_check_repository="owner/repo/extra")
    assert Settings(release_check_repository="").release_check_repository is None
    assert Settings().release_check_repository is None
