from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from inorganic_api.models import AttemptEvent, User


def lock_user_writes(db: Session, user_id: UUID) -> None:
    # Serialize writes for one account so server_seq follows commit order. A
    # cursor must never pass an event whose transaction has not committed yet.
    lock_key = int.from_bytes(user_id.bytes[:8], byteorder="big", signed=True)
    db.execute(select(func.pg_advisory_xact_lock(lock_key)))


def insert_if_absent(db: Session, values: dict) -> bool:
    statement = (
        insert(AttemptEvent)
        .values(**values)
        .on_conflict_do_nothing(index_elements=[AttemptEvent.user_id, AttemptEvent.event_id])
        .returning(AttemptEvent.server_seq)
    )
    return db.scalar(statement) is not None


def get_by_event_id(db: Session, user_id: UUID, event_id: str) -> AttemptEvent | None:
    return db.scalar(
        select(AttemptEvent).where(
            AttemptEvent.user_id == user_id, AttemptEvent.event_id == event_id
        )
    )


def list_for_user(db: Session, user_id: UUID, after: int, limit: int) -> list[AttemptEvent]:
    return list(
        db.scalars(
            select(AttemptEvent)
            .where(AttemptEvent.user_id == user_id, AttemptEvent.server_seq > after)
            .order_by(AttemptEvent.server_seq)
            .limit(limit)
        )
    )


def mode_counts(db: Session, user_id: UUID | None = None) -> list[tuple[str, int, int]]:
    statement = select(
        AttemptEvent.mode,
        func.count(AttemptEvent.server_seq),
        func.count(AttemptEvent.server_seq).filter(AttemptEvent.is_correct),
    )
    if user_id is None:
        statement = statement.join(User, User.id == AttemptEvent.user_id).where(
            User.role != "tester"
        )
    else:
        statement = statement.where(AttemptEvent.user_id == user_id)
    return [
        (mode, total, correct)
        for mode, total, correct in db.execute(statement.group_by(AttemptEvent.mode))
    ]


def daily_counts(db: Session, user_id: UUID, since: datetime) -> list[tuple[object, int, int]]:
    day = func.date(func.timezone("UTC", AttemptEvent.received_at))
    statement = (
        select(
            day,
            func.count(AttemptEvent.server_seq),
            func.count(AttemptEvent.server_seq).filter(AttemptEvent.is_correct),
        )
        .where(AttemptEvent.user_id == user_id, AttemptEvent.received_at >= since)
        .group_by(day)
        .order_by(day)
    )
    return list(db.execute(statement))


def list_users(db: Session, after: str, limit: int) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .where(User.username > after, User.role != "guest")
            .order_by(User.username)
            .limit(limit + 1)
        )
    )


def get_user(db: Session, user_id: UUID) -> User | None:
    return db.get(User, user_id)
