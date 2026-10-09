from functools import lru_cache
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Path
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from inorganic_api.api.dependencies import require_csrf, require_role
from inorganic_api.config import get_settings
from inorganic_api.errors import AppError, ErrorEnvelope
from inorganic_api.services import curriculum
from inorganic_api.services.auth import AuthenticatedSession
from inorganic_api.services.curriculum_github import CurriculumRepository

PRODUCT_ID = r"^preparation-production\.product\.[a-z0-9]+(?:-[a-z0-9]+)*$"
ROUTE_ID = r"^preparation-production\.route\.[a-z0-9]+(?:-[a-z0-9]+)*$"
SOURCE_ID = r"^id-[a-z0-9-]+$"
FINGERPRINT = r"^sha256:[a-f0-9]{64}$"


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)


class EquationTerm(_Model):
    coefficient: int = Field(ge=1, le=999)
    formula: str = Field(min_length=1, max_length=256)
    accepted_aliases: list[Annotated[str, Field(min_length=1, max_length=256)]] | None = Field(
        default=None, max_length=10
    )


class ProductNote(_Model):
    kind: Literal["preparation", "manufacture"]
    text: str = Field(min_length=1, max_length=2000)


class ContentSource(_Model):
    title: str = Field(min_length=1, max_length=300)
    locator: str = Field(min_length=9, max_length=2048, pattern=r"^https://\S+$")


class _Evidence(_Model):
    review_fingerprint: str | None = Field(default=None, pattern=FINGERPRINT)
    review_evidence: str | None = Field(default=None, min_length=1, max_length=300)
    review_evidence_confirmed_by: str | None = Field(default=None, min_length=1, max_length=120)


class RouteInput(_Evidence):
    id: str = Field(pattern=ROUTE_ID, max_length=200)
    source_id: str = Field(pattern=SOURCE_ID, max_length=100)
    kind: Literal["preparation", "manufacture"]
    reactants: list[EquationTerm] = Field(min_length=1, max_length=20)
    products: list[EquationTerm] = Field(min_length=1, max_length=20)
    conditions_cs: str | None = Field(max_length=120)
    status: Literal["owner-approved", "in-review", "reviewed", "deprecated"]
    review_note: str | None = Field(default=None, min_length=1, max_length=2000)


class ProductInput(_Evidence):
    id: str = Field(pattern=PRODUCT_ID, max_length=200)
    name_cs: str = Field(min_length=1, max_length=120)
    formula: str = Field(min_length=1, max_length=256)
    notes: list[ProductNote] = Field(max_length=20)
    routes: list[RouteInput] = Field(max_length=50)
    status: Literal["owner-approved", "reviewed", "deprecated"]
    sources: list[ContentSource] = Field(min_length=1, max_length=10)


class SaveProductRequest(_Model):
    product: ProductInput
    base_sha: str = Field(pattern=r"^[0-9a-f]{40}$")


class SaveProductResponse(_Model):
    file_sha: str
    pull_request_url: str


class _StoredReview(_Model):
    model_config = ConfigDict(extra="ignore", alias_generator=to_camel, populate_by_name=True)

    reviewed_by: str | None = None
    reviewed_at: str | None = None
    review_fingerprint: str | None = None
    review_evidence: str | None = None
    review_evidence_confirmed_by: str | None = None


class StoredTerm(_Model):
    model_config = ConfigDict(extra="ignore", alias_generator=to_camel, populate_by_name=True)

    coefficient: int
    formula: str
    accepted_aliases: list[str] | None = None


class StoredRoute(_StoredReview):
    id: str
    source_id: str
    kind: str
    reactants: list[StoredTerm]
    products: list[StoredTerm]
    conditions_cs: str | None
    status: str
    review_note: str | None = None


class StoredProduct(_StoredReview):
    id: str
    name_cs: str
    formula: str
    notes: list[dict[str, str]]
    routes: list[StoredRoute]
    status: str
    author: str
    sources: list[dict[str, str]]
    owner_approved_by: str
    owner_approved_at: str


class PreparationProductionResponse(_Model):
    content_version: str
    products: list[StoredProduct]
    file_sha: str
    pending_changes: bool
    pull_request_url: str | None
    can_validate: bool


router = APIRouter(tags=["curriculum"])


@lru_cache
def _repository_for(repository: str, token: str) -> CurriculumRepository:
    return CurriculumRepository(repository, token)


def curriculum_repository_dependency() -> CurriculumRepository | None:
    settings = get_settings()
    if not settings.curriculum_github_repository or not settings.curriculum_github_token:
        return None
    return _repository_for(settings.curriculum_github_repository, settings.curriculum_github_token)


def _require_repository(repository: CurriculumRepository | None) -> CurriculumRepository:
    if repository is None:
        raise AppError(
            503,
            "curriculum_editing_disabled",
            "Editing content from the application is disabled.",
        )
    return repository


def _route_record(route: RouteInput) -> dict[str, Any]:
    record = route.model_dump(by_alias=True, exclude_none=True)
    record["conditionsCs"] = route.conditions_cs
    return record


def _product_record(product: ProductInput) -> dict[str, Any]:
    record = product.model_dump(by_alias=True, exclude_none=True)
    record["routes"] = [_route_record(route) for route in product.routes]
    return record


@router.get(
    "/admin/curriculum/preparation-production",
    operation_id="getPreparationProductionCurriculum",
    response_model=PreparationProductionResponse,
    responses={
        401: {"model": ErrorEnvelope},
        403: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
    summary="Show the preparation and production equations with their review state",
)
def get_preparation_production(
    current: Annotated[AuthenticatedSession, Depends(require_role("admin"))],
    repository: Annotated[CurriculumRepository | None, Depends(curriculum_repository_dependency)],
) -> PreparationProductionResponse:
    snapshot = curriculum.load_preparation_production(_require_repository(repository))
    return PreparationProductionResponse(
        content_version=str(snapshot.collection.get("contentVersion", "")),
        products=[StoredProduct.model_validate(item) for item in snapshot.collection["products"]],
        file_sha=snapshot.file_sha,
        pending_changes=snapshot.pending_changes,
        pull_request_url=snapshot.pull_request_url,
        can_validate=current.user.id in get_settings().curriculum_sme_reviewer_ids,
    )


@router.put(
    "/admin/curriculum/preparation-production/products/{product_id}",
    operation_id="savePreparationProductionProduct",
    response_model=SaveProductResponse,
    responses={
        401: {"model": ErrorEnvelope},
        403: {"model": ErrorEnvelope},
        409: {"model": ErrorEnvelope},
        413: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
    summary="Create or change one product and its equations on the curation pull request",
)
def save_preparation_production_product(
    product_id: Annotated[str, Path(pattern=PRODUCT_ID, max_length=200)],
    body: SaveProductRequest,
    current: Annotated[AuthenticatedSession, Depends(require_csrf)],
    repository: Annotated[CurriculumRepository | None, Depends(curriculum_repository_dependency)],
) -> SaveProductResponse:
    if current.user.role != "admin":
        raise AppError(403, "forbidden", "Access denied.")
    if body.product.id != product_id:
        raise AppError(422, "curriculum_id_mismatch", "The product ID does not match the URL.")
    result = curriculum.save_product(
        _require_repository(repository),
        current.user,
        get_settings().curriculum_sme_reviewer_ids.get(current.user.id),
        _product_record(body.product),
        body.base_sha,
    )
    return SaveProductResponse(file_sha=result.file_sha, pull_request_url=result.pull_request_url)
