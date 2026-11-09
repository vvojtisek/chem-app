import json
from collections.abc import Iterator
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from inorganic_api.api import subjects as subjects_api
from inorganic_api.api.dependencies import get_current_user, require_csrf
from inorganic_api.database import session_dependency
from inorganic_api.errors import AppError
from inorganic_api.main import app
from inorganic_api.services import subjects as subject_service
from inorganic_api.services.explanations import Explainer
from inorganic_api.services.renders import RenderQueue
from inorganic_api.services.subjects import SolveLimits, solve_isolated
from inorganic_api.subjects.catalog import default_registry

LIMIT_EXAMPLE = {"expression": "sin(x)/x", "variable": "x", "point": "0", "direction": "+-"}


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def session(role: str = "user") -> SimpleNamespace:
    return SimpleNamespace(user=SimpleNamespace(id=uuid4(), role=role), session=None)


class Limiter:
    def __init__(self, allow: bool = True) -> None:
        self.allow = allow
        self.calls: list[tuple[str, str, int, timedelta]] = []

    def __call__(self, kind: str, value: str, limit: int, window: timedelta) -> bool:
        self.calls.append((kind, value, limit, window))
        return self.allow


def in_process_solver(subject_id: str, problem_type: str, values: dict[str, str]):
    return default_registry().get(subject_id).run(problem_type, values)


@pytest.fixture
def overrides() -> Iterator[dict[Any, Any]]:
    limiter = Limiter()
    app.dependency_overrides[session_dependency] = lambda: None
    app.dependency_overrides[subjects_api.rate_limiter_dependency] = lambda: limiter
    app.dependency_overrides[subjects_api.solver_dependency] = lambda: in_process_solver
    app.dependency_overrides["limiter"] = limiter  # type: ignore[index]
    yield app.dependency_overrides
    app.dependency_overrides.clear()


def as_user(overrides: dict[Any, Any], role: str = "user") -> None:
    current = session(role)
    overrides[require_csrf] = lambda: current
    overrides[get_current_user] = lambda: current


async def call(method: str, path: str, body: dict[str, Any] | None = None):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as http:
        return await http.request(method, f"/api/v1/subjects{path}", json=body)


@pytest.mark.anyio
async def test_list_subjects_describes_problem_types(overrides) -> None:
    as_user(overrides)
    response = await call("GET", "")
    assert response.status_code == 200
    subjects = response.json()["subjects"]
    assert [item["id"] for item in subjects] == ["matematika"]
    types = {item["id"] for item in subjects[0]["problemTypes"]}
    assert {"limit", "derivative", "integral", "partial", "multiple_integral"} <= types
    assert subjects[0]["renderingEnabled"] is False
    assert subjects[0]["explanationsEnabled"] is False


@pytest.mark.anyio
async def test_solve_returns_steps_and_scene(overrides) -> None:
    as_user(overrides)
    response = await call(
        "POST", "/matematika/solve", {"problemType": "limit", "values": LIMIT_EXAMPLE}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["resultLatex"] == "1"
    assert body["steps"][0]["rule"] == "lhopital"
    assert body["scene"]["kind"] == "limit_2d"
    kind, _, limit, window = overrides["limiter"].calls[0]
    assert (kind, limit, window) == ("subject-solve", 60, timedelta(minutes=10))


@pytest.mark.anyio
async def test_guest_and_anonymous_requests_are_rejected(overrides) -> None:
    anonymous = await call("POST", "/matematika/solve", {"problemType": "limit", "values": {}})
    assert anonymous.status_code == 401
    as_user(overrides, role="guest")
    guest = await call(
        "POST", "/matematika/solve", {"problemType": "limit", "values": LIMIT_EXAMPLE}
    )
    assert guest.status_code == 403
    assert overrides["limiter"].calls == []


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("path", "body", "status", "code"),
    [
        ("/fyzika/solve", {"problemType": "limit", "values": {}}, 404, "unknown_subject"),
        ("/matematika/solve", {"problemType": "nope", "values": {}}, 422, "unknown_problem_type"),
        (
            "/matematika/solve",
            {"problemType": "limit", "values": {**LIMIT_EXAMPLE, "extra": "1"}},
            422,
            "unknown_field",
        ),
        (
            "/matematika/solve",
            {"problemType": "limit", "values": {**LIMIT_EXAMPLE, "direction": "x"}},
            422,
            "invalid_choice",
        ),
    ],
)
async def test_invalid_requests_fail_before_solving(overrides, path, body, status, code) -> None:
    as_user(overrides)
    response = await call("POST", path, body)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert overrides["limiter"].calls == []


@pytest.mark.anyio
async def test_parse_errors_are_translated(overrides) -> None:
    as_user(overrides)
    overrides[subjects_api.solver_dependency] = subjects_api.solver_dependency
    response = await call(
        "POST",
        "/matematika/solve",
        {"problemType": "limit", "values": {**LIMIT_EXAMPLE, "expression": "__import__('os')"}},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unexpected_character"


@pytest.mark.anyio
async def test_rate_limit_is_enforced(overrides) -> None:
    as_user(overrides)
    overrides[subjects_api.rate_limiter_dependency] = lambda: Limiter(allow=False)
    response = await call(
        "POST", "/matematika/solve", {"problemType": "limit", "values": LIMIT_EXAMPLE}
    )
    assert response.status_code == 429


@pytest.mark.anyio
async def test_render_is_disabled_by_default(overrides) -> None:
    as_user(overrides)
    response = await call(
        "POST", "/matematika/renders", {"problemType": "limit", "values": LIMIT_EXAMPLE}
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "rendering_disabled"


@pytest.mark.anyio
async def test_render_queue_round_trip(overrides, tmp_path: Path) -> None:
    as_user(overrides)
    queue = RenderQueue(tmp_path)
    overrides[subjects_api.render_queue_dependency] = lambda: queue
    request = {"problemType": "limit", "values": LIMIT_EXAMPLE, "format": "mp4"}

    first = await call("POST", "/matematika/renders", request)
    assert first.status_code == 202
    key = first.json()["key"]
    assert first.json()["status"] == "queued"
    job = json.loads((tmp_path / "queue" / f"{key}.json").read_text())
    assert job["key"] == key and job["spec"]["kind"] == "limit_2d"

    again = await call("POST", "/matematika/renders", request)
    assert again.json() == first.json()
    render_calls = [c for c in overrides["limiter"].calls if c[0] == "subject-render"]
    assert len(render_calls) == 2  # per account and global, only for the first request
    assert [(c[1] == "all", c[2], c[3]) for c in render_calls] == [
        (False, 10, timedelta(hours=1)),
        (True, 100, timedelta(hours=1)),
    ]

    (tmp_path / "out").mkdir(exist_ok=True)
    (tmp_path / "out" / f"{key}.mp4").write_bytes(b"\x00\x00\x00\x18ftypmp42")
    status = await call("GET", f"/matematika/renders/{key}")
    assert status.json()["status"] == "done"
    video = await call("GET", status.json()["videoUrl"].removeprefix("/api/v1/subjects"))
    assert video.status_code == 200
    assert video.headers["content-type"] == "video/mp4"


@pytest.mark.anyio
async def test_render_key_must_be_hex(overrides, tmp_path: Path) -> None:
    as_user(overrides)
    overrides[subjects_api.render_queue_dependency] = lambda: RenderQueue(tmp_path)
    response = await call("GET", "/matematika/renders/..%2F..%2Fetc%2Fpasswd/video")
    assert response.status_code in (404, 422)


@pytest.mark.anyio
async def test_explanation_uses_schema_and_drops_out_of_range_steps(overrides) -> None:
    as_user(overrides)
    prompts: list[str] = []

    def completion(system: str, user: str) -> str:
        prompts.append(user)
        return json.dumps(
            {
                "summary": "Použijeme L'Hôpitalovo pravidlo.",
                "step_narratives": [
                    {"step_index": 0, "narrative": "Typ 0/0."},
                    {"step_index": 99, "narrative": "Neexistující krok."},
                ],
                "alternative_methods": ["Taylorův rozvoj sin x."],
                "common_mistakes": [],
            }
        )

    overrides[subjects_api.explainer_dependency] = lambda: Explainer(completion)
    request = {"problemType": "limit", "values": LIMIT_EXAMPLE}
    response = await call("POST", "/matematika/explanations", request)
    assert response.status_code == 200, response.text
    body = response.json()
    assert [item["stepIndex"] for item in body["stepNarratives"]] == [0]
    assert body["generated"] is True
    assert "lhopital" in prompts[0]


@pytest.mark.anyio
async def test_invalid_model_output_is_rejected(overrides) -> None:
    as_user(overrides)
    overrides[subjects_api.explainer_dependency] = lambda: Explainer(lambda _s, _u: '{"x": 1}')
    response = await call(
        "POST", "/matematika/explanations", {"problemType": "limit", "values": LIMIT_EXAMPLE}
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "explanation_unavailable"


def test_isolated_solver_returns_solution_and_caches() -> None:
    subject_service.clear_cache()
    limits = SolveLimits(timeout_seconds=30, memory_mb=1024)
    first = solve_isolated(
        "matematika", "derivative", {"expression": "x^3", "variable": "x", "order": "1"}, limits
    )
    assert first.result_latex == "3 x^{2}"
    assert (
        solve_isolated(
            "matematika", "derivative", {"expression": "x^3", "variable": "x", "order": "1"}, limits
        )
        is first
    )


def test_isolated_solver_times_out() -> None:
    subject_service.clear_cache()
    with pytest.raises(AppError) as error:
        solve_isolated(
            "matematika",
            "integral",
            {"expression": "x e^x", "variable": "x"},
            SolveLimits(timeout_seconds=0.001, memory_mb=1024),
        )
    assert (error.value.status_code, error.value.code) == (422, "problem_too_complex")


@pytest.mark.anyio
async def test_preview_returns_latex_and_field_errors(overrides) -> None:
    as_user(overrides)
    response = await call(
        "POST",
        "/matematika/preview",
        {
            "problemType": "limit",
            "values": {"expression": "sin(x)/x", "point": "oo", "variable": "x"},
        },
    )
    assert response.status_code == 200, response.text
    fields = response.json()["fields"]
    assert fields["expression"]["latex"] == r"\frac{\sin{\left(x \right)}}{x}"
    assert fields["point"]["latex"] == r"\infty"
    assert "variable" not in fields
    broken = await call(
        "POST", "/matematika/preview", {"problemType": "limit", "values": {"expression": "x +"}}
    )
    assert broken.json()["fields"]["expression"] == {"latex": None, "error": "Výraz je neúplný."}
