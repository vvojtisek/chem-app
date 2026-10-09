import base64
import hashlib
import json
import threading
import urllib.parse
from collections.abc import Iterator
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from inorganic_api.api.curriculum import curriculum_repository_dependency
from inorganic_api.api.dependencies import get_current_user, require_csrf
from inorganic_api.config import Settings
from inorganic_api.errors import AppError
from inorganic_api.main import app
from inorganic_api.services import curriculum
from inorganic_api.services.curriculum import (
    CURATION_BRANCH,
    PREPARATION_PRODUCTION_PATH,
    format_content_json,
    load_preparation_production,
    save_product,
)
from inorganic_api.services.curriculum_github import (
    CurriculumRepository,
    FileChangedError,
    send_request,
)

REPOSITORY = "vvojtisek/chem-app"
TOKEN = "github-token-for-tests"
CONTENT_DIR = Path(__file__).resolve().parents[3] / "content" / "data"
NOW = datetime(2026, 10, 10, 8, 30, 5, tzinfo=UTC)
SME_REVIEWER = "reviewer.vvojtisek"
FINGERPRINT = "sha256:" + "a" * 64


def blob_sha(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()  # noqa: S324 - fake Git object id


class FakeGitHub:
    """An in-memory stand-in for the GitHub REST endpoints the adapter uses."""

    def __init__(self, files: dict[str, str]) -> None:
        self.commits: dict[str, dict[str, str]] = {}
        self.branches = {"main": self._commit(files)}
        self.pulls: list[dict[str, Any]] = []
        self.requests: list[tuple[str, str]] = []
        self.tokens: set[str] = set()

    def _commit(self, files: dict[str, str]) -> str:
        sha = hashlib.sha1(json.dumps(files, sort_keys=True).encode()).hexdigest()  # noqa: S324
        sha = hashlib.sha1(f"{sha}{len(self.commits)}".encode()).hexdigest()  # noqa: S324
        self.commits[sha] = dict(files)
        return sha

    def files(self, branch: str) -> dict[str, str]:
        return self.commits[self.branches[branch]]

    def __call__(
        self, method: str, url: str, body: dict[str, Any] | None, token: str
    ) -> tuple[int, bytes]:
        self.tokens.add(token)
        prefix = f"https://api.github.com/repos/{REPOSITORY}"
        assert url.startswith(prefix)
        parsed = urllib.parse.urlsplit(url[len(prefix) :])
        path = urllib.parse.unquote(parsed.path)
        query = dict(urllib.parse.parse_qsl(parsed.query))
        self.requests.append((method, path))

        def reply(status: int, data: object = None) -> tuple[int, bytes]:
            return status, b"" if data is None else json.dumps(data).encode()

        if method == "GET" and path.startswith("/git/ref/heads/"):
            branch = path.removeprefix("/git/ref/heads/")
            if branch not in self.branches:
                return reply(404, {"message": "Not Found"})
            return reply(200, {"object": {"sha": self.branches[branch]}})
        if method == "PATCH" and path.startswith("/git/refs/heads/"):
            assert body is not None and body["force"] is True
            self.branches[path.removeprefix("/git/refs/heads/")] = body["sha"]
            return reply(200, {})
        if method == "POST" and path == "/git/refs":
            assert body is not None
            self.branches[body["ref"].removeprefix("refs/heads/")] = body["sha"]
            return reply(201, {})
        if method == "GET" and path == "/pulls":
            head = query["head"].split(":", 1)[1]
            return reply(
                200,
                [p for p in self.pulls if p["head"] == head and p["state"] == query["state"]],
            )
        if method == "POST" and path == "/pulls":
            assert body is not None
            url_ = f"https://github.com/{REPOSITORY}/pull/{100 + len(self.pulls)}"
            self.pulls.append({**body, "state": "open", "html_url": url_})
            return reply(201, {"html_url": url_})
        if path.startswith("/contents/"):
            file_path = path.removeprefix("/contents/")
            if method == "GET":
                text = self.files(query["ref"])[file_path]
                return reply(
                    200,
                    {
                        "encoding": "base64",
                        "content": base64.b64encode(text.encode()).decode(),
                        "sha": blob_sha(text),
                    },
                )
            if method == "PUT":
                assert body is not None
                files = self.files(body["branch"])
                if blob_sha(files[file_path]) != body["sha"]:
                    return reply(409, {"message": "conflict"})
                text = base64.b64decode(body["content"]).decode()
                self.branches[body["branch"]] = self._commit({**files, file_path: text})
                return reply(200, {"content": {"sha": blob_sha(text)}})
        raise AssertionError(f"Unexpected GitHub request {method} {path}")


def load_dataset() -> str:
    return (CONTENT_DIR / "preparation-production.json").read_text(encoding="utf-8")


@pytest.fixture
def github() -> FakeGitHub:
    return FakeGitHub({PREPARATION_PRODUCTION_PATH: load_dataset()})


@pytest.fixture
def repository(github: FakeGitHub) -> CurriculumRepository:
    return CurriculumRepository(REPOSITORY, TOKEN, send=github)


def admin() -> SimpleNamespace:
    return SimpleNamespace(id=uuid4(), role="admin")


def first_product(text: str) -> dict[str, Any]:
    return json.loads(text)["products"][0]


def editable(product: dict[str, Any]) -> dict[str, Any]:
    """Strip the fields the server owns, as the admin console sends them."""
    server_owned = {"author", "ownerApprovedBy", "ownerApprovedAt", "reviewedBy", "reviewedAt"}
    result = {key: value for key, value in product.items() if key not in server_owned}
    result["routes"] = [
        {key: value for key, value in route.items() if key not in server_owned}
        for route in product["routes"]
    ]
    return result


def branch_dataset(github: FakeGitHub) -> dict[str, Any]:
    return json.loads(github.files(CURATION_BRANCH)[PREPARATION_PRODUCTION_PATH])


@pytest.mark.parametrize("name", sorted(path.name for path in CONTENT_DIR.glob("*.json")))
def test_format_matches_the_committed_content_files(name: str) -> None:
    text = (CONTENT_DIR / name).read_text(encoding="utf-8")
    assert format_content_json(json.loads(text)) == text


def test_load_reads_main_until_a_curation_pull_request_is_open(
    github: FakeGitHub, repository: CurriculumRepository
) -> None:
    snapshot = load_preparation_production(repository)
    assert snapshot.pending_changes is False
    assert snapshot.pull_request_url is None
    assert snapshot.file_sha == blob_sha(load_dataset())
    assert github.tokens == {TOKEN}


def test_first_save_starts_a_curation_branch_and_pull_request(
    github: FakeGitHub, repository: CurriculumRepository
) -> None:
    snapshot = load_preparation_production(repository)
    product = editable(snapshot.collection["products"][0])
    product["nameCs"] = "Vodík (upraveno)"

    result = save_product(repository, admin(), None, product, snapshot.file_sha, now=NOW)

    assert github.pulls[0]["head"] == CURATION_BRANCH
    assert github.pulls[0]["base"] == "main"
    assert github.pulls[0]["title"].startswith("fix(content): ")
    assert result.pull_request_url == github.pulls[0]["html_url"]
    saved = branch_dataset(github)
    assert saved["contentVersion"] == "preparation-production-2026-10-10-083005"
    assert saved["products"][0]["nameCs"] == "Vodík (upraveno)"
    original = first_product(load_dataset())
    assert saved["products"][0]["author"] == original["author"]
    assert saved["products"][0]["ownerApprovedBy"] == original["ownerApprovedBy"]
    assert github.files("main")[PREPARATION_PRODUCTION_PATH] == load_dataset()

    reloaded = load_preparation_production(repository)
    assert reloaded.pending_changes is True
    assert reloaded.file_sha == result.file_sha
    assert reloaded.collection["products"][0]["nameCs"] == "Vodík (upraveno)"


def test_unchanged_save_keeps_the_file_byte_for_byte_apart_from_the_version(
    github: FakeGitHub, repository: CurriculumRepository
) -> None:
    snapshot = load_preparation_production(repository)
    product = editable(snapshot.collection["products"][0])
    save_product(repository, admin(), None, product, snapshot.file_sha, now=NOW)

    before = json.loads(load_dataset())
    after = branch_dataset(github)
    before["contentVersion"] = after["contentVersion"]
    assert format_content_json(before) == github.files(CURATION_BRANCH)[PREPARATION_PRODUCTION_PATH]


def test_later_saves_extend_the_open_pull_request_without_another_version_bump(
    github: FakeGitHub, repository: CurriculumRepository
) -> None:
    snapshot = load_preparation_production(repository)
    product = editable(snapshot.collection["products"][0])
    first = save_product(repository, admin(), None, product, snapshot.file_sha, now=NOW)
    version = branch_dataset(github)["contentVersion"]

    second_product = editable(snapshot.collection["products"][1])
    second_product["nameCs"] = "Změněno"
    later = NOW.replace(hour=12)
    second = save_product(repository, admin(), None, second_product, first.file_sha, now=later)

    assert len(github.pulls) == 1
    assert second.pull_request_url == first.pull_request_url
    assert branch_dataset(github)["contentVersion"] == version


def test_a_stale_base_is_rejected(github: FakeGitHub, repository: CurriculumRepository) -> None:
    snapshot = load_preparation_production(repository)
    product = editable(snapshot.collection["products"][0])
    save_product(repository, admin(), None, product, snapshot.file_sha, now=NOW)

    with pytest.raises(AppError) as error:
        save_product(repository, admin(), None, product, snapshot.file_sha, now=NOW)
    assert (error.value.status_code, error.value.code) == (409, "curriculum_changed")


def test_a_concurrent_write_is_reported_as_stale(repository: CurriculumRepository) -> None:
    def write_conflict(*_args: object, **_kwargs: object) -> str:
        raise FileChangedError

    snapshot = load_preparation_production(repository)
    product = editable(snapshot.collection["products"][0])
    repository.write_file = write_conflict  # type: ignore[method-assign]
    with pytest.raises(AppError) as error:
        save_product(repository, admin(), None, product, snapshot.file_sha, now=NOW)
    assert error.value.code == "curriculum_changed"


def new_product() -> dict[str, Any]:
    return {
        "id": "preparation-production.product.test-ozon",
        "nameCs": "Ozon",
        "formula": "O3",
        "notes": [],
        "routes": [
            {
                "id": "preparation-production.route.test-ozon-1",
                "sourceId": "id-test-1",
                "kind": "preparation",
                "reactants": [{"coefficient": 3, "formula": "O2"}],
                "products": [{"coefficient": 2, "formula": "O3"}],
                "conditionsCs": None,
                "status": "owner-approved",
            }
        ],
        "status": "owner-approved",
        "sources": [{"title": "Skripta", "locator": "https://example.test/skripta"}],
    }


def test_a_new_product_is_appended_with_server_owned_attribution(
    github: FakeGitHub, repository: CurriculumRepository
) -> None:
    snapshot = load_preparation_production(repository)
    save_product(repository, admin(), None, new_product(), snapshot.file_sha, now=NOW)

    saved = branch_dataset(github)["products"][-1]
    assert saved["id"] == "preparation-production.product.test-ozon"
    assert saved["author"] == curriculum.NEW_PRODUCT_AUTHOR
    assert saved["ownerApprovedBy"] == curriculum.NEW_PRODUCT_OWNER_APPROVAL
    assert saved["ownerApprovedAt"] == "2026-10-10"
    assert list(saved) == [
        "id",
        "nameCs",
        "formula",
        "notes",
        "routes",
        "status",
        "author",
        "sources",
        "ownerApprovedBy",
        "ownerApprovedAt",
    ]
    assert saved["routes"][0]["conditionsCs"] is None


def save_error(
    repository: CurriculumRepository, product: dict[str, Any], reviewer: str | None = None
) -> AppError:
    snapshot = load_preparation_production(repository)
    with pytest.raises(AppError) as error:
        save_product(repository, admin(), reviewer, product, snapshot.file_sha, now=NOW)
    return error.value


def test_routes_cannot_be_deleted(repository: CurriculumRepository) -> None:
    product = editable(first_product(load_dataset()))
    removed = product["routes"].pop()
    error = save_error(repository, product)
    assert (error.status_code, error.code) == (422, "curriculum_route_removed")
    assert error.details == {"routeIds": [removed["id"]]}


def test_route_ids_must_stay_unique_across_products(repository: CurriculumRepository) -> None:
    product = new_product()
    product["routes"][0]["id"] = first_product(load_dataset())["routes"][0]["id"]
    assert save_error(repository, product).code == "curriculum_duplicate_id"


def test_held_routes_need_a_reason(repository: CurriculumRepository) -> None:
    product = new_product()
    product["routes"][0]["status"] = "in-review"
    assert save_error(repository, product).code == "curriculum_review_note_required"


def test_deprecation_is_saved_and_cannot_be_undone(
    github: FakeGitHub, repository: CurriculumRepository
) -> None:
    snapshot = load_preparation_production(repository)
    product = editable(snapshot.collection["products"][0])
    product["routes"][0]["status"] = "deprecated"
    result = save_product(repository, admin(), None, product, snapshot.file_sha, now=NOW)
    assert branch_dataset(github)["products"][0]["routes"][0]["status"] == "deprecated"

    product["routes"][0]["status"] = "owner-approved"
    with pytest.raises(AppError) as error:
        save_product(repository, admin(), None, product, result.file_sha, now=NOW)
    assert (error.value.status_code, error.value.code) == (409, "curriculum_record_deprecated")


def validated(product: dict[str, Any], **evidence: str) -> dict[str, Any]:
    route = product["routes"][0]
    route.update(
        {
            "status": "reviewed",
            "reviewFingerprint": FINGERPRINT,
            "reviewEvidence": "Skripta VŠCHT, s. 12",
            **evidence,
        }
    )
    return product


def test_only_a_registered_sme_can_validate(repository: CurriculumRepository) -> None:
    product = validated(editable(first_product(load_dataset())))
    error = save_error(repository, product, reviewer=None)
    assert (error.status_code, error.code) == (403, "curriculum_sme_required")


def test_validation_needs_evidence(repository: CurriculumRepository) -> None:
    product = validated(editable(first_product(load_dataset())))
    del product["routes"][0]["reviewEvidence"]
    error = save_error(repository, product, reviewer=SME_REVIEWER)
    assert (error.status_code, error.code) == (422, "curriculum_evidence_required")


def test_validation_records_the_signed_in_reviewer_and_server_date(
    github: FakeGitHub, repository: CurriculumRepository
) -> None:
    snapshot = load_preparation_production(repository)
    product = validated(
        editable(snapshot.collection["products"][0]),
        reviewEvidenceConfirmedBy="prof. Example",
    )
    result = save_product(repository, admin(), SME_REVIEWER, product, snapshot.file_sha, now=NOW)

    route = branch_dataset(github)["products"][0]["routes"][0]
    assert route["status"] == "reviewed"
    assert route["reviewedBy"] == SME_REVIEWER
    assert route["reviewedAt"] == "2026-10-10"
    assert route["reviewFingerprint"] == FINGERPRINT
    assert route["reviewEvidence"] == "Skripta VŠCHT, s. 12"
    assert route["reviewEvidenceConfirmedBy"] == "prof. Example"
    assert list(route)[-5:] == [
        "reviewedBy",
        "reviewedAt",
        "reviewFingerprint",
        "reviewEvidence",
        "reviewEvidenceConfirmedBy",
    ]

    # Saving again later keeps the original attestation date.
    reloaded = load_preparation_production(repository)
    again = editable(reloaded.collection["products"][0])
    save_product(repository, admin(), SME_REVIEWER, again, result.file_sha, now=NOW.replace(day=20))
    assert branch_dataset(github)["products"][0]["routes"][0]["reviewedAt"] == "2026-10-10"

    # Reopening the record removes the whole review.
    reopened = load_preparation_production(repository)
    edited = editable(reopened.collection["products"][0])
    edited["routes"][0]["status"] = "owner-approved"
    save_product(repository, admin(), None, edited, reopened.file_sha, now=NOW)
    route = branch_dataset(github)["products"][0]["routes"][0]
    assert route["status"] == "owner-approved"
    assert not {key for key in route if key.startswith("review")}


def test_non_admins_cannot_save(repository: CurriculumRepository) -> None:
    snapshot = load_preparation_production(repository)
    product = editable(snapshot.collection["products"][0])
    with pytest.raises(AppError) as error:
        save_product(
            repository, SimpleNamespace(id=uuid4(), role="user"), None, product, snapshot.file_sha
        )
    assert error.value.status_code == 403


@pytest.mark.parametrize(
    ("status", "payload"),
    [(500, b"{}"), (401, b"{}"), (200, b"not json"), (200, b"{}")],
)
def test_github_failures_become_a_service_error(status: int, payload: bytes) -> None:
    repository = CurriculumRepository(REPOSITORY, TOKEN, send=lambda *_args: (status, payload))
    with pytest.raises(AppError) as error:
        repository.read_file(PREPARATION_PRODUCTION_PATH, "main")
    assert (error.value.status_code, error.value.code) == (
        503,
        "curriculum_repository_unavailable",
    )


def test_github_network_errors_become_a_service_error() -> None:
    def offline(*_args: object) -> tuple[int, bytes]:
        raise OSError("offline")

    with pytest.raises(AppError) as error:
        CurriculumRepository(REPOSITORY, TOKEN, send=offline).branch_exists("main")
    assert error.value.code == "curriculum_repository_unavailable"


@pytest.fixture
def local_github(monkeypatch) -> Iterator[tuple[str, list[dict[str, str]]]]:
    requests: list[dict[str, str]] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - http.server naming
            requests.append(
                {"path": self.path, "authorization": self.headers.get("Authorization", "")}
            )
            if self.path == "/redirect":
                self.send_response(302)
                self.send_header("Location", "/elsewhere")
                self.end_headers()
                return
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"{}")

        def log_message(self, *_args: object) -> None:
            pass

    for name in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
        monkeypatch.delenv(name, raising=False)
    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", requests
    finally:
        server.shutdown()
        server.server_close()


def test_send_uses_the_bearer_token_and_never_follows_redirects(local_github) -> None:
    base, requests = local_github
    assert send_request("GET", f"{base}/ok", None, TOKEN) == (200, b"{}")
    assert send_request("GET", f"{base}/redirect", None, TOKEN)[0] == 302
    assert [request["path"] for request in requests] == ["/ok", "/redirect"]
    assert {request["authorization"] for request in requests} == {f"Bearer {TOKEN}"}


def test_settings_require_repository_and_token_together() -> None:
    with pytest.raises(ValidationError, match="CURRICULUM_GITHUB"):
        Settings(curriculum_github_repository=REPOSITORY)
    with pytest.raises(ValidationError, match="CURRICULUM_GITHUB"):
        Settings(curriculum_github_token=TOKEN)
    settings = Settings(curriculum_github_repository="", curriculum_github_token="")
    assert settings.curriculum_github_repository is None


def test_settings_parse_sme_reviewer_accounts() -> None:
    account = uuid4()
    settings = Settings(curriculum_sme_reviewers=f"{account}=reviewer.vvojtisek")
    assert settings.curriculum_sme_reviewer_ids == {account: "reviewer.vvojtisek"}
    assert Settings().curriculum_sme_reviewer_ids == {}
    for invalid in (
        "reviewer.vvojtisek",
        f"{account}=someone",
        f"{account}=reviewer.a,",
        "------------------------------------=reviewer.a",
    ):
        with pytest.raises(ValidationError):
            Settings(curriculum_sme_reviewers=invalid)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def overrides():
    yield app.dependency_overrides
    for dependency in (get_current_user, require_csrf, curriculum_repository_dependency):
        app.dependency_overrides.pop(dependency, None)


def session_for(user: SimpleNamespace):
    return lambda: SimpleNamespace(user=user, session=None)


async def request(method: str, path: str, **kwargs: Any) -> tuple[int, Any]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as http:
        response = await http.request(method, f"/api/v1/admin/curriculum{path}", **kwargs)
    return response.status_code, response.json()


@pytest.mark.anyio
async def test_get_lists_products_for_admins_only(overrides, github: FakeGitHub) -> None:
    overrides[curriculum_repository_dependency] = lambda: CurriculumRepository(
        REPOSITORY, TOKEN, send=github
    )
    overrides[get_current_user] = session_for(SimpleNamespace(id=uuid4(), role="user"))
    status, body = await request("GET", "/preparation-production")
    assert (status, body["error"]["code"]) == (403, "forbidden")

    overrides[get_current_user] = session_for(admin())
    status, body = await request("GET", "/preparation-production")
    assert status == 200
    assert body["fileSha"] == blob_sha(load_dataset())
    assert body["pendingChanges"] is False
    assert body["canValidate"] is False
    assert len(body["products"]) == len(json.loads(load_dataset())["products"])
    assert body["products"][0]["routes"][0]["conditionsCs"] is None


@pytest.mark.anyio
async def test_get_reports_disabled_editing(overrides) -> None:
    overrides[curriculum_repository_dependency] = lambda: None
    overrides[get_current_user] = session_for(admin())
    status, body = await request("GET", "/preparation-production")
    assert (status, body["error"]["code"]) == (503, "curriculum_editing_disabled")


@pytest.mark.anyio
async def test_put_requires_csrf_before_touching_github(overrides, github: FakeGitHub) -> None:
    overrides[curriculum_repository_dependency] = lambda: CurriculumRepository(
        REPOSITORY, TOKEN, send=github
    )
    product = editable(first_product(load_dataset()))
    status, _ = await request(
        "PUT",
        f"/preparation-production/products/{product['id']}",
        json={"product": product, "baseSha": blob_sha(load_dataset())},
    )
    assert status == 401
    assert github.requests == []


@pytest.mark.anyio
async def test_put_saves_through_the_pull_request(overrides, github: FakeGitHub) -> None:
    overrides[curriculum_repository_dependency] = lambda: CurriculumRepository(
        REPOSITORY, TOKEN, send=github
    )
    overrides[require_csrf] = session_for(admin())
    product = editable(first_product(load_dataset()))
    status, body = await request(
        "PUT",
        f"/preparation-production/products/{product['id']}",
        json={"product": product, "baseSha": blob_sha(load_dataset())},
    )
    assert status == 200
    assert body["pullRequestUrl"] == github.pulls[0]["html_url"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("change", "code"),
    [
        (lambda product: product.update(reviewedBy=SME_REVIEWER), "validation_error"),
        (lambda product: product["routes"][0].update(reviewedAt="2026-01-01"), "validation_error"),
        (
            lambda product: product.update(id="preparation-production.product.other"),
            "curriculum_id_mismatch",
        ),
        (lambda product: product.update(sources=[]), "validation_error"),
    ],
)
async def test_put_rejects_server_owned_fields_and_bad_input(
    overrides, github: FakeGitHub, change, code: str
) -> None:
    overrides[curriculum_repository_dependency] = lambda: CurriculumRepository(
        REPOSITORY, TOKEN, send=github
    )
    overrides[require_csrf] = session_for(admin())
    product = editable(first_product(load_dataset()))
    path = f"/preparation-production/products/{product['id']}"
    change(product)
    status, body = await request(
        "PUT", path, json={"product": product, "baseSha": blob_sha(load_dataset())}
    )
    assert (status, body["error"]["code"]) == (422, code)
    assert github.pulls == []
