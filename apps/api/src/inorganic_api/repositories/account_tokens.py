from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from inorganic_api.models import EmailVerificationToken, PasswordResetToken


def verification_for_update(db: Session, digest: str) -> EmailVerificationToken | None:
    return db.scalar(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.token_hash == digest)
        .with_for_update()
    )


def reset_for_update(db: Session, digest: str) -> PasswordResetToken | None:
    return db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == digest).with_for_update()
    )


def revoke_verifications(db: Session, user_id: UUID, now: datetime) -> None:
    db.execute(
        delete(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.expires_at > now,
        )
    )


def revoke_resets(db: Session, user_id: UUID) -> None:
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
