"""Who may edit and validate curriculum data (ADR 0014, amendment 2026-10-11).

Every administrator counts as a chemistry SME, and an administrator can mark any
learner or tester account as one. An SME may edit the datasets in the admin
console. Validating also needs a reviewer entry in ``content/data/reviewers.json``:
either an entry mapped to the account in ``CURRICULUM_SME_REVIEWERS`` or the
public name and qualification the SME entered themselves, which the API commits
to the content repository with their first validation.
"""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session

from inorganic_api.errors import AppError
from inorganic_api.models import User

SME_ROLES = ("user", "tester")


@dataclass(frozen=True)
class CurriculumReviewer:
    id: str
    # The reviewers.json entry to keep in the repository; None when the entry is
    # maintained by hand (accounts mapped in CURRICULUM_SME_REVIEWERS).
    entry: dict[str, str] | None


def is_curriculum_sme(user: User) -> bool:
    if not user.is_active:
        return False
    return user.role == "admin" or (user.curriculum_sme and user.role in SME_ROLES)


def require_curriculum_sme(user: User) -> None:
    if not is_curriculum_sme(user):
        raise AppError(403, "forbidden", "Access denied.")


def account_reviewer_id(account_id: UUID) -> str:
    return f"reviewer.account-{account_id.hex[:12]}"


def curriculum_reviewer(user: User, configured: dict[UUID, str]) -> CurriculumReviewer | None:
    """The reviewer identity a validation by ``user`` is recorded under, if any."""
    if not is_curriculum_sme(user):
        return None
    if user.id in configured:
        return CurriculumReviewer(configured[user.id], None)
    if not user.sme_public_name or not user.sme_qualification:
        return None
    reviewer_id = account_reviewer_id(user.id)
    return CurriculumReviewer(
        reviewer_id,
        {
            "id": reviewer_id,
            "name": user.sme_public_name,
            "role": "chemistry-sme",
            "qualification": user.sme_qualification,
        },
    )


def update_reviewer_profile(db: Session, user: User, public_name: str, qualification: str) -> User:
    """Store the SME's own public reviewer entry; it is published with their next validation."""
    require_curriculum_sme(user)
    user.sme_public_name = public_name
    user.sme_qualification = qualification
    db.commit()
    return user
