from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from inorganic_api.config import Settings
from inorganic_api.repositories import maintenance, sessions


def purge_expired_state(
    db: Session, settings: Settings, now: datetime | None = None
) -> dict[str, int]:
    now = now or datetime.now(UTC)
    counts = {
        "sessions": sessions.purge_expired(db, now),
        "throttles": maintenance.delete_stale_throttles(db, now),
        "tokens": maintenance.delete_obsolete_tokens(db, now),
        "unverified_accounts": maintenance.delete_expired_unverified_users(db, now),
        "guest_accounts": maintenance.delete_inactive_guest_accounts(
            db, now, guest_max_age=timedelta(seconds=settings.session_absolute_ttl)
        ),
        "mail_outbox": maintenance.delete_old_mail_outbox(db, now),
    }
    db.commit()
    return counts
