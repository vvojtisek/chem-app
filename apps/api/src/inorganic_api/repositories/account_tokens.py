from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from inorganic_api.models import PasswordResetToken


def reset_for_update(db: Session, digest: str) -> PasswordResetToken | None:
    return db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == digest).with_for_update()
    )


def revoke_resets(db: Session, user_id: UUID) -> None:
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
