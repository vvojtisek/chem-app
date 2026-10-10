"""Edit reviewed curriculum files from the admin console through a pull request (ADR 0014).

Edits and SME validations accumulate on one curation branch with one open pull
request. The API checks shape, identity and review rules; chemistry validity
(parsing, balance, review fingerprints) is checked by ``pnpm content:validate``
in CI before the owner merges. The API never computes chemistry itself.
"""

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from inorganic_api.errors import AppError
from inorganic_api.models import User
from inorganic_api.services.curriculum_github import (
    CurriculumRepository,
    FileChangedError,
    git_blob_sha,
)

logger = logging.getLogger(__name__)

BASE_BRANCH = "main"
CURATION_BRANCH = "content/curation"
PREPARATION_PRODUCTION_PATH = "content/data/preparation-production.json"
PREPARATION_PRODUCTION_VERSION_PREFIX = "preparation-production-"
NOMENCLATURE_PATH = "content/data/nomenclature.json"
NOMENCLATURE_SNAPSHOT_PATH = "content/generated/nomenclature-runtime.json"
PUBLISHED_STATUSES = ("owner-approved", "reviewed")
PULL_REQUEST_TITLE = "fix(content): apply curriculum changes from the admin console"
PULL_REQUEST_BODY = (
    "Changes and chemistry-SME validations recorded in the admin console (ADR 0014).\n\n"
    "Every save adds a commit to this branch. CI runs `pnpm content:validate`, which checks "
    "formulas, balance, coefficients and review fingerprints. Merge when the batch is done."
)
NEW_PRODUCT_AUTHOR = "Admin console"
NEW_PRODUCT_OWNER_APPROVAL = "Content owner via the admin console"

PRODUCT_KEY_ORDER = (
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
    "reviewedBy",
    "reviewedAt",
    "reviewFingerprint",
    "reviewEvidence",
    "reviewEvidenceConfirmedBy",
)
ROUTE_KEY_ORDER = (
    "id",
    "sourceId",
    "kind",
    "reactants",
    "products",
    "conditionsCs",
    "status",
    "reviewNote",
    "reviewedBy",
    "reviewedAt",
    "reviewFingerprint",
    "reviewEvidence",
    "reviewEvidenceConfirmedBy",
)
NOMENCLATURE_KEY_ORDER = (
    "id",
    "sourceKey",
    "formula",
    "charge",
    "nameCs",
    "explanationCs",
    "baseCategory",
    "tags",
    "difficulty",
    "contextCs",
    "directions",
    "aliases",
    "disposition",
    "reviewIssues",
    "status",
    "author",
    "sources",
    "reviewedBy",
    "reviewedAt",
    "reviewFingerprint",
    "reviewEvidence",
    "reviewEvidenceConfirmedBy",
    "ownerApprovedBy",
    "ownerApprovedAt",
)
REVIEW_KEYS = (
    "reviewedBy",
    "reviewedAt",
    "reviewFingerprint",
    "reviewEvidence",
    "reviewEvidenceConfirmedBy",
)
EVIDENCE_KEYS = ("reviewFingerprint", "reviewEvidence", "reviewEvidenceConfirmedBy")


@dataclass(frozen=True)
class CurriculumSnapshot:
    collection: dict[str, Any]
    file_sha: str
    pending_changes: bool
    pull_request_url: str | None


@dataclass(frozen=True)
class SaveResult:
    file_sha: str
    pull_request_url: str


def load_preparation_production(repository: CurriculumRepository) -> CurriculumSnapshot:
    """Return the dataset as the owner currently sees it.

    While a curation pull request is open, its branch holds the pending edits and
    validations; otherwise the base branch is current.
    """
    pull_request_url = repository.open_pull_request_url(CURATION_BRANCH, BASE_BRANCH)
    branch = CURATION_BRANCH if pull_request_url else BASE_BRANCH
    file = repository.read_file(PREPARATION_PRODUCTION_PATH, branch)
    return CurriculumSnapshot(
        collection=_parse_collection(file.text),
        file_sha=file.sha,
        pending_changes=pull_request_url is not None,
        pull_request_url=pull_request_url,
    )


def save_product(
    repository: CurriculumRepository,
    actor: User,
    reviewer_id: str | None,
    product: dict[str, Any],
    base_sha: str,
    *,
    now: datetime | None = None,
) -> SaveResult:
    """Create or replace one product (with its routes) on the curation branch."""
    if actor.role != "admin":
        raise AppError(403, "forbidden", "Access denied.")
    now = now or datetime.now(UTC)
    today = now.date().isoformat()

    pull_request_url = repository.open_pull_request_url(CURATION_BRANCH, BASE_BRANCH)
    base_file = repository.read_file(PREPARATION_PRODUCTION_PATH, BASE_BRANCH)
    if pull_request_url is None:
        # No pending batch: start a fresh one from the base branch so merged or
        # rejected history never leaks into the next pull request.
        repository.reset_branch(CURATION_BRANCH, repository.branch_sha(BASE_BRANCH))
    current_file = repository.read_file(PREPARATION_PRODUCTION_PATH, CURATION_BRANCH)
    if current_file.sha != base_sha:
        raise _stale()

    collection = _parse_collection(current_file.text)
    products: list[dict[str, Any]] = collection["products"]
    index = next((i for i, item in enumerate(products) if item.get("id") == product["id"]), None)
    current = None if index is None else products[index]
    merged = _merge_product(product, current, reviewer_id, today)
    _check_route_ids(products, index, merged)
    if index is None:
        products.append(merged)
    else:
        products[index] = merged

    base_version = _parse_collection(base_file.text).get("contentVersion")
    if collection.get("contentVersion") == base_version:
        collection["contentVersion"] = _content_version(now)

    action = "create" if current is None else "update"
    try:
        file_sha = repository.write_file(
            PREPARATION_PRODUCTION_PATH,
            CURATION_BRANCH,
            format_content_json(collection),
            current_file.sha,
            f"chore(content): {action} {product['id']} from the admin console",
        )
    except FileChangedError as exc:
        raise _stale() from exc
    if pull_request_url is None:
        pull_request_url = repository.create_pull_request(
            CURATION_BRANCH, BASE_BRANCH, PULL_REQUEST_TITLE, PULL_REQUEST_BODY
        )
    logger.warning(
        "Curriculum change: account=%s action=%s product=%s status=%s validated_routes=%s pr=%s",
        actor.id,
        action,
        product["id"],
        merged["status"],
        sum(1 for route in merged["routes"] if route["status"] == "reviewed"),
        pull_request_url,
    )
    return SaveResult(file_sha=file_sha, pull_request_url=pull_request_url)


def load_nomenclature(repository: CurriculumRepository) -> CurriculumSnapshot:
    """Return the nomenclature records as the owner currently sees them."""
    pull_request_url = repository.open_pull_request_url(CURATION_BRANCH, BASE_BRANCH)
    branch = CURATION_BRANCH if pull_request_url else BASE_BRANCH
    file = repository.read_file(NOMENCLATURE_PATH, branch)
    return CurriculumSnapshot(
        collection=_parse_collection(file.text, "records"),
        file_sha=file.sha,
        pending_changes=pull_request_url is not None,
        pull_request_url=pull_request_url,
    )


def save_nomenclature_record(
    repository: CurriculumRepository,
    actor: User,
    reviewer_id: str | None,
    record: dict[str, Any],
    runtime_snapshot: dict[str, Any],
    base_sha: str,
    *,
    now: datetime | None = None,
) -> SaveResult:
    """Create or replace one nomenclature record on the curation branch.

    The learner app reads the generated runtime snapshot, so it is committed in the
    same commit as the records. The admin console derives it with the content
    package's own code; the API checks only that it publishes exactly the
    published records, and CI rejects a snapshot that differs from a fresh build.
    """
    if actor.role != "admin":
        raise AppError(403, "forbidden", "Access denied.")
    now = now or datetime.now(UTC)
    today = now.date().isoformat()

    pull_request_url = repository.open_pull_request_url(CURATION_BRANCH, BASE_BRANCH)
    if pull_request_url is None:
        repository.reset_branch(CURATION_BRANCH, repository.branch_sha(BASE_BRANCH))
    head = repository.branch_sha(CURATION_BRANCH)
    current_file = repository.read_file(NOMENCLATURE_PATH, head)
    if current_file.sha != base_sha:
        raise _stale()

    collection = _parse_collection(current_file.text, "records")
    records: list[dict[str, Any]] = collection["records"]
    index = next((i for i, item in enumerate(records) if item.get("id") == record["id"]), None)
    current = None if index is None else records[index]
    merged = _merge_nomenclature_record(record, current, reviewer_id, today)
    if index is None:
        records.append(merged)
    else:
        records[index] = merged

    published = {item["id"] for item in records if item.get("status") in PUBLISHED_STATUSES}
    snapshot_ids = [compound["id"] for compound in runtime_snapshot["compounds"]]
    if len(snapshot_ids) != len(set(snapshot_ids)) or set(snapshot_ids) != published:
        raise AppError(
            422,
            "curriculum_snapshot_mismatch",
            "The runtime snapshot does not match the published records.",
        )

    records_text = format_content_json(collection)
    action = "create" if current is None else "update"
    try:
        repository.commit_files(
            CURATION_BRANCH,
            head,
            {
                NOMENCLATURE_PATH: records_text,
                NOMENCLATURE_SNAPSHOT_PATH: format_content_json(runtime_snapshot),
            },
            f"chore(content): {action} {record['id']} from the admin console",
        )
    except FileChangedError as exc:
        raise _stale() from exc
    if pull_request_url is None:
        pull_request_url = repository.create_pull_request(
            CURATION_BRANCH, BASE_BRANCH, PULL_REQUEST_TITLE, PULL_REQUEST_BODY
        )
    logger.warning(
        "Curriculum change: account=%s action=%s record=%s status=%s pr=%s",
        actor.id,
        action,
        record["id"],
        merged["status"],
        pull_request_url,
    )
    return SaveResult(file_sha=git_blob_sha(records_text), pull_request_url=pull_request_url)


def _merge_nomenclature_record(
    incoming: dict[str, Any],
    current: dict[str, Any] | None,
    reviewer_id: str | None,
    today: str,
) -> dict[str, Any]:
    if (
        current is not None
        and current.get("status") == "deprecated"
        and incoming["status"] != "deprecated"
    ):
        raise AppError(409, "curriculum_record_deprecated", "A removed record cannot be restored.")
    record = _apply_review(incoming, current, reviewer_id, today)
    record["author"] = NEW_PRODUCT_AUTHOR if current is None else current["author"]
    for key in ("ownerApprovedBy", "ownerApprovedAt"):
        if current is not None and key in current:
            record[key] = current[key]
    if record["status"] == "owner-approved" and "ownerApprovedBy" not in record:
        # Publishing a record from the console is the owner's release decision.
        record["ownerApprovedBy"] = NEW_PRODUCT_OWNER_APPROVAL
        record["ownerApprovedAt"] = today
    return _ordered(record, NOMENCLATURE_KEY_ORDER)


def _merge_product(
    incoming: dict[str, Any],
    current: dict[str, Any] | None,
    reviewer_id: str | None,
    today: str,
) -> dict[str, Any]:
    if (
        current is not None
        and current.get("status") == "deprecated"
        and incoming["status"] != ("deprecated")
    ):
        raise AppError(409, "curriculum_record_deprecated", "A removed record cannot be restored.")
    current_routes = {route["id"]: route for route in (current or {}).get("routes", [])}
    missing = sorted(set(current_routes) - {route["id"] for route in incoming["routes"]})
    if missing:
        raise AppError(
            422,
            "curriculum_route_removed",
            "Routes cannot be deleted; mark them as removed instead.",
            details={"routeIds": missing},
        )
    routes = []
    for route in incoming["routes"]:
        previous = current_routes.get(route["id"])
        if (
            previous is not None
            and previous.get("status") == "deprecated"
            and route["status"] != "deprecated"
        ):
            raise AppError(
                409, "curriculum_record_deprecated", "A removed record cannot be restored."
            )
        if route["status"] == "in-review" and not route.get("reviewNote"):
            raise AppError(
                422,
                "curriculum_review_note_required",
                "A route held for review needs a reason.",
                details={"routeId": route["id"]},
            )
        routes.append(_ordered(_apply_review(route, previous, reviewer_id, today), ROUTE_KEY_ORDER))

    product = {key: value for key, value in incoming.items() if key != "routes"}
    product["routes"] = routes
    if current is None:
        product["author"] = NEW_PRODUCT_AUTHOR
        product["ownerApprovedBy"] = NEW_PRODUCT_OWNER_APPROVAL
        product["ownerApprovedAt"] = today
    else:
        for key in ("author", "ownerApprovedBy", "ownerApprovedAt"):
            product[key] = current[key]
    return _ordered(_apply_review(product, current, reviewer_id, today), PRODUCT_KEY_ORDER)


def _apply_review(
    incoming: dict[str, Any],
    current: dict[str, Any] | None,
    reviewer_id: str | None,
    today: str,
) -> dict[str, Any]:
    """Keep, record or clear the SME review of one record.

    The reviewer and date always come from the signed-in account and the server
    clock. An unchanged validation keeps its original reviewer and date.
    """
    record = {key: value for key, value in incoming.items() if key not in REVIEW_KEYS}
    if incoming["status"] != "reviewed":
        return record
    unchanged = (
        current is not None
        and current.get("status") == "reviewed"
        and all(current.get(key) == incoming.get(key) for key in EVIDENCE_KEYS)
    )
    if unchanged and current is not None:
        record.update({key: current[key] for key in REVIEW_KEYS if key in current})
        return record
    if reviewer_id is None:
        raise AppError(
            403,
            "curriculum_sme_required",
            "Only an administrator registered as a chemistry SME can validate content.",
        )
    if not incoming.get("reviewFingerprint") or not incoming.get("reviewEvidence"):
        raise AppError(
            422,
            "curriculum_evidence_required",
            "Validation needs the review fingerprint and an evidence reference.",
            details={"recordId": incoming["id"]},
        )
    record.update(
        {
            "reviewedBy": reviewer_id,
            "reviewedAt": today,
            "reviewFingerprint": incoming["reviewFingerprint"],
            "reviewEvidence": incoming["reviewEvidence"],
        }
    )
    if incoming.get("reviewEvidenceConfirmedBy"):
        record["reviewEvidenceConfirmedBy"] = incoming["reviewEvidenceConfirmedBy"]
    return record


def _check_route_ids(
    products: list[dict[str, Any]], index: int | None, merged: dict[str, Any]
) -> None:
    own = [route["id"] for route in merged["routes"]]
    if len(own) != len(set(own)):
        raise AppError(422, "curriculum_duplicate_id", "Route IDs must be unique.")
    others = {
        route["id"]
        for i, product in enumerate(products)
        if i != index
        for route in product.get("routes", [])
    }
    clashes = sorted(others.intersection(own))
    if clashes:
        raise AppError(
            422,
            "curriculum_duplicate_id",
            "Route IDs must be unique.",
            details={"routeIds": clashes},
        )


def _content_version(now: datetime) -> str:
    """A new version per batch; seconds keep two batches on one day distinct."""
    return f"{PREPARATION_PRODUCTION_VERSION_PREFIX}{now.strftime('%Y-%m-%d-%H%M%S')}"


def _ordered(record: dict[str, Any], order: tuple[str, ...]) -> dict[str, Any]:
    return {key: record[key] for key in order if key in record}


def _parse_collection(text: str, items_key: str = "products") -> dict[str, Any]:
    try:
        data = json.loads(text)
    except ValueError as exc:
        raise AppError(
            503, "curriculum_repository_unavailable", "The content repository is unavailable."
        ) from exc
    if not isinstance(data, dict) or not isinstance(data.get(items_key), list):
        raise AppError(
            503, "curriculum_repository_unavailable", "The content repository is unavailable."
        )
    return data


def _stale() -> AppError:
    return AppError(
        409,
        "curriculum_changed",
        "The dataset changed since it was loaded. Reload it and repeat the change.",
    )


def format_content_json(value: Any) -> str:
    """Serialize like the repository's Biome JSON formatter, so diffs stay minimal.

    Objects are always expanded; arrays of scalars stay on one line.
    """
    return _format(value, 0) + "\n"


def _format(value: Any, indent: int) -> str:
    pad = " " * indent
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = [
            f"{pad}  {json.dumps(key, ensure_ascii=False)}: {_format(item, indent + 2)}"
            for key, item in value.items()
        ]
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(value, list):
        if not value:
            return "[]"
        if all(not isinstance(item, dict | list) for item in value):
            return "[" + ", ".join(json.dumps(item, ensure_ascii=False) for item in value) + "]"
        return (
            "[\n"
            + ",\n".join(pad + "  " + _format(item, indent + 2) for item in value)
            + "\n"
            + pad
            + "]"
        )
    return json.dumps(value, ensure_ascii=False)
