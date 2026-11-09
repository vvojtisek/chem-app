"""Generic HTTP routes for subject modules (ADR 0015).

Routes are the same for every registered subject; adding a subject does not
change this file.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Path
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy.orm import Session

from inorganic_api.api.dependencies import get_current_user, require_csrf
from inorganic_api.config import Settings, get_settings
from inorganic_api.database import session_dependency
from inorganic_api.errors import AppError, ErrorEnvelope
from inorganic_api.services import auth
from inorganic_api.services import explanations as explanation_service
from inorganic_api.services import renders as render_service
from inorganic_api.services.subjects import SolveLimits, solve_isolated
from inorganic_api.subjects.base import Step, SubjectError, SubjectSolution
from inorganic_api.subjects.catalog import default_registry
from inorganic_api.subjects.registry import SubjectRegistry
from inorganic_api.subjects.rendering.spec import SceneSpec

LEARNER_ROLES = frozenset({"user", "tester", "admin"})
SOLVE_LIMIT = 60
RENDER_LIMIT_PER_ACCOUNT = 10
RENDER_LIMIT_GLOBAL = 100
EXPLAIN_LIMIT = 20

SubjectId = Annotated[str, Path(pattern=r"^[a-z][a-z0-9-]{1,31}$")]
RenderKey = Annotated[str, Path(pattern=r"^[0-9a-f]{64}$")]

router = APIRouter(prefix="/subjects", tags=["subjects"])


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)


class ChoiceOptionModel(_Model):
    value: str
    label: str


class InputFieldModel(_Model):
    name: str
    label: str
    kind: Literal["expression", "equation", "constant", "bound", "vector", "variable", "choice"]
    required: bool
    placeholder: str
    help: str
    default: str | None
    options: list[ChoiceOptionModel]


class ProblemTypeModel(_Model):
    id: str
    label: str
    description: str
    fields: list[InputFieldModel]
    example: dict[str, str]


class SubjectModel(_Model):
    id: str
    label: str
    description: str
    problem_types: list[ProblemTypeModel]
    export_formats: list[Literal["mp4", "gif", "svg", "web"]]
    rendering_enabled: bool
    explanations_enabled: bool


class SubjectListResponse(_Model):
    subjects: list[SubjectModel]


class ProblemRequest(_Model):
    problem_type: str = Field(pattern=r"^[a-z][a-z_]{1,39}$")
    values: dict[str, str] = Field(max_length=12)

    @field_validator("values")
    @classmethod
    def bounded_values(cls, values: dict[str, str]) -> dict[str, str]:
        for name, value in values.items():
            if len(name) > 32 or len(value) > 200:
                raise ValueError("field name or value too long")
        return values


class StepModel(_Model):
    rule: str
    title: str
    before: str
    after: str
    justification: str
    rewritten: str | None
    substeps: list[StepModel]


class SolveResponse(_Model):
    subject_id: str
    problem_type: str
    problem_latex: str
    result_latex: str
    steps: list[StepModel]
    verified_by: str
    notes: list[str]
    scene: SceneSpec | None


class RenderRequest(ProblemRequest):
    format: Literal["mp4", "gif"] = "mp4"


class RenderStatusResponse(_Model):
    key: str
    status: Literal["queued", "rendering", "done", "failed"]
    video_url: str | None


class StepNarrativeModel(_Model):
    step_index: int
    narrative: str


class ExplanationResponse(_Model):
    summary: str
    step_narratives: list[StepNarrativeModel]
    alternative_methods: list[str]
    common_mistakes: list[str]
    generated: Literal[True] = True


def registry_dependency() -> SubjectRegistry:
    return default_registry()


def require_learner(
    current: Annotated[auth.AuthenticatedSession, Depends(get_current_user)],
) -> auth.AuthenticatedSession:
    if current.user.role not in LEARNER_ROLES:
        raise AppError(403, "forbidden", "Access denied.")
    return current


def require_learner_csrf(
    current: Annotated[auth.AuthenticatedSession, Depends(require_csrf)],
) -> auth.AuthenticatedSession:
    if current.user.role not in LEARNER_ROLES:
        raise AppError(403, "forbidden", "Access denied.")
    return current


RateLimiter = Callable[[str, str, int], bool]


def rate_limiter_dependency(
    db: Annotated[Session, Depends(session_dependency)],
) -> RateLimiter:
    settings = get_settings()

    def consume(kind: str, value: str, limit: int) -> bool:
        return auth.consume_rate_limit(db, settings, kind, value, limit=limit)

    return consume


Solver = Callable[[str, str, dict[str, str]], SubjectSolution]


def solver_dependency() -> Solver:
    settings = get_settings()
    limits = SolveLimits(settings.math_solve_timeout_seconds, settings.math_solve_memory_mb)

    def solve(subject_id: str, problem_type: str, values: dict[str, str]) -> SubjectSolution:
        return solve_isolated(subject_id, problem_type, values, limits)

    return solve


def _step_model(step: Step) -> StepModel:
    return StepModel(
        rule=step.rule,
        title=step.title,
        before=step.before,
        after=step.after,
        justification=step.justification,
        rewritten=step.rewritten,
        substeps=[_step_model(item) for item in step.substeps],
    )


def _subject_model(module: Any, settings: Settings) -> SubjectModel:
    description = module.describe()
    return SubjectModel(
        id=description.id,
        label=description.label,
        description=description.description,
        problem_types=[
            ProblemTypeModel(
                id=item.id,
                label=item.label,
                description=item.description,
                fields=[
                    InputFieldModel(
                        name=field.name,
                        label=field.label,
                        kind=field.kind,
                        required=field.required,
                        placeholder=field.placeholder,
                        help=field.help,
                        default=field.default,
                        options=[
                            ChoiceOptionModel(value=option.value, label=option.label)
                            for option in field.options
                        ],
                    )
                    for field in item.fields
                ],
                example=dict(item.example),
            )
            for item in description.problem_types
        ],
        export_formats=list(description.export_formats),
        rendering_enabled=settings.math_render_enabled and "mp4" in description.export_formats,
        explanations_enabled=settings.math_llm_api_key is not None,
    )


def _validated(
    registry: SubjectRegistry, subject_id: str, request: ProblemRequest
) -> dict[str, str]:
    try:
        return registry.get(subject_id).validate_values(request.problem_type, request.values)
    except SubjectError as error:
        status = 404 if error.code == "unknown_subject" else 422
        raise AppError(status, error.code, error.message) from error


def _rate_limit(limiter: RateLimiter, kind: str, user_id: str, limit: int) -> None:
    if not limiter(kind, user_id, limit):
        raise AppError(429, "too_many_attempts", "Too many requests. Try again later.")


_ERRORS: dict[int | str, dict[str, Any]] = {
    status: {"model": ErrorEnvelope} for status in (401, 403, 404, 422, 429, 503)
}


@router.get(
    "",
    operation_id="listSubjects",
    response_model=SubjectListResponse,
    responses=_ERRORS,
    summary="List subject modules and their problem types",
)
def list_subjects(
    _current: Annotated[auth.AuthenticatedSession, Depends(require_learner)],
    registry: Annotated[SubjectRegistry, Depends(registry_dependency)],
) -> SubjectListResponse:
    settings = get_settings()
    return SubjectListResponse(subjects=[_subject_model(module, settings) for module in registry])


@router.post(
    "/{subject_id}/solve",
    operation_id="solveSubjectProblem",
    response_model=SolveResponse,
    responses=_ERRORS,
    summary="Solve a problem step by step",
)
def solve_problem(
    subject_id: SubjectId,
    request: ProblemRequest,
    current: Annotated[auth.AuthenticatedSession, Depends(require_learner_csrf)],
    registry: Annotated[SubjectRegistry, Depends(registry_dependency)],
    limiter: Annotated[RateLimiter, Depends(rate_limiter_dependency)],
    solver: Annotated[Solver, Depends(solver_dependency)],
) -> SolveResponse:
    values = _validated(registry, subject_id, request)
    _rate_limit(limiter, "subject-solve", str(current.user.id), SOLVE_LIMIT)
    solution = solver(subject_id, request.problem_type, values)
    return SolveResponse(
        subject_id=solution.subject_id,
        problem_type=solution.problem_type,
        problem_latex=solution.problem_latex,
        result_latex=solution.result_latex,
        steps=[_step_model(step) for step in solution.steps],
        verified_by=solution.verified_by,
        notes=list(solution.notes),
        scene=solution.scene,
    )


def render_queue_dependency() -> render_service.RenderQueue | None:
    settings = get_settings()
    if not settings.math_render_enabled:
        return None
    return render_service.RenderQueue(settings.math_render_dir)


def _status_response(subject_id: str, key: str, status: str) -> RenderStatusResponse:
    url = f"/api/v1/subjects/{subject_id}/renders/{key}/video" if status == "done" else None
    return RenderStatusResponse(key=key, status=status, video_url=url)  # type: ignore[arg-type]


@router.post(
    "/{subject_id}/renders",
    operation_id="requestSubjectRender",
    response_model=RenderStatusResponse,
    status_code=202,
    responses=_ERRORS,
    summary="Queue an animation of the solution",
)
def request_render(
    subject_id: SubjectId,
    request: RenderRequest,
    current: Annotated[auth.AuthenticatedSession, Depends(require_learner_csrf)],
    registry: Annotated[SubjectRegistry, Depends(registry_dependency)],
    limiter: Annotated[RateLimiter, Depends(rate_limiter_dependency)],
    solver: Annotated[Solver, Depends(solver_dependency)],
    queue: Annotated[render_service.RenderQueue | None, Depends(render_queue_dependency)],
) -> RenderStatusResponse:
    if queue is None:
        raise AppError(503, "rendering_disabled", "Vykreslování animací není zapnuté.")
    values = _validated(registry, subject_id, request)
    _rate_limit(limiter, "subject-solve", str(current.user.id), SOLVE_LIMIT)
    # The scene is always rebuilt on the server; a client-supplied scene is never trusted.
    solution = solver(subject_id, request.problem_type, values)
    if solution.scene is None:
        raise AppError(422, "nothing_to_render", "K této úloze není co vykreslit.")
    key = render_service.key_for(solution.scene, request.format)
    status = queue.status(key)
    if status in ("done", "queued", "rendering"):
        return _status_response(subject_id, key, status)
    _rate_limit(limiter, "subject-render", str(current.user.id), RENDER_LIMIT_PER_ACCOUNT)
    _rate_limit(limiter, "subject-render", "all", RENDER_LIMIT_GLOBAL)
    queue.enqueue(solution.scene, request.format)
    return _status_response(subject_id, key, "queued")


@router.get(
    "/{subject_id}/renders/{key}",
    operation_id="getSubjectRender",
    response_model=RenderStatusResponse,
    responses=_ERRORS,
    summary="Show the state of a queued animation",
)
def get_render(
    subject_id: SubjectId,
    key: RenderKey,
    _current: Annotated[auth.AuthenticatedSession, Depends(require_learner)],
    queue: Annotated[render_service.RenderQueue | None, Depends(render_queue_dependency)],
) -> RenderStatusResponse:
    if queue is None:
        raise AppError(503, "rendering_disabled", "Vykreslování animací není zapnuté.")
    status = queue.status(key)
    if status is None:
        raise AppError(404, "render_not_found", "Animace neexistuje.")
    return _status_response(subject_id, key, status)


@router.get(
    "/{subject_id}/renders/{key}/video",
    operation_id="getSubjectRenderVideo",
    response_class=FileResponse,
    responses={**_ERRORS, 200: {"content": {"video/mp4": {}, "image/gif": {}}}},
    summary="Download a finished animation",
)
def get_render_video(
    subject_id: SubjectId,
    key: RenderKey,
    _current: Annotated[auth.AuthenticatedSession, Depends(require_learner)],
    queue: Annotated[render_service.RenderQueue | None, Depends(render_queue_dependency)],
) -> FileResponse:
    if queue is None:
        raise AppError(503, "rendering_disabled", "Vykreslování animací není zapnuté.")
    found = queue.output(key)
    if found is None:
        raise AppError(404, "render_not_found", "Animace neexistuje.")
    path, media_type = found
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )


def explainer_dependency() -> explanation_service.Explainer | None:
    settings = get_settings()
    if settings.math_llm_api_key is None:
        return None
    return explanation_service.cached_explainer(settings.math_llm_api_key, settings.math_llm_model)


@router.post(
    "/{subject_id}/explanations",
    operation_id="explainSubjectSolution",
    response_model=ExplanationResponse,
    responses=_ERRORS,
    summary="Generate a narrative explanation of the solution",
)
def explain_solution(
    subject_id: SubjectId,
    request: ProblemRequest,
    current: Annotated[auth.AuthenticatedSession, Depends(require_learner_csrf)],
    registry: Annotated[SubjectRegistry, Depends(registry_dependency)],
    limiter: Annotated[RateLimiter, Depends(rate_limiter_dependency)],
    solver: Annotated[Solver, Depends(solver_dependency)],
    explainer: Annotated[explanation_service.Explainer | None, Depends(explainer_dependency)],
) -> ExplanationResponse:
    if explainer is None:
        raise AppError(503, "explanations_disabled", "Vysvětlení nejsou zapnutá.")
    values = _validated(registry, subject_id, request)
    _rate_limit(limiter, "subject-solve", str(current.user.id), SOLVE_LIMIT)
    solution = solver(subject_id, request.problem_type, values)
    cached = explainer.cached(solution)
    if cached is None:
        _rate_limit(limiter, "subject-explain", str(current.user.id), EXPLAIN_LIMIT)
    explanation = cached or explainer.explain(solution)
    return ExplanationResponse(
        summary=explanation.summary,
        step_narratives=[
            StepNarrativeModel(step_index=item.step_index, narrative=item.narrative)
            for item in explanation.step_narratives
        ],
        alternative_methods=list(explanation.alternative_methods),
        common_mistakes=list(explanation.common_mistakes),
    )
