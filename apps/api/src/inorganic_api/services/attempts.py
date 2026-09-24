import base64
import binascii
import hashlib
import json
from datetime import UTC, datetime, time, timedelta
from uuid import UUID

from pydantic import TypeAdapter
from sqlalchemy.orm import Session

from inorganic_api.api.attempt_schemas import (
    AdminUser,
    AdminUserPage,
    AttemptInput,
    AttemptItem,
    AttemptPage,
    AttemptStats,
    BatchResponse,
    DailyTrend,
    ModeStats,
    Progression,
    Rank,
)
from inorganic_api.errors import AppError
from inorganic_api.models import User
from inorganic_api.repositories import attempts as repository

EVENT_ADAPTER = TypeAdapter(AttemptInput)
RANKS = (
    ("novice", "Začátečník", 0),
    ("student", "Student", 50),
    ("advanced", "Pokročilý", 250),
    ("master", "Mistr anorganické chemie", 1000),
)


def _require_owner(actor: User, owner_id: UUID) -> None:
    if actor.id != owner_id and actor.role != "admin":
        raise AppError(403, "forbidden", "Access denied.")


def _require_admin(actor: User) -> None:
    if actor.role != "admin":
        raise AppError(403, "forbidden", "Access denied.")


def _encode_cursor(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("ascii").rstrip("=")


def _decode_cursor(cursor: str | None, kind: str) -> str:
    if cursor is None:
        return "0" if kind == "attempt" else ""
    try:
        decoded = base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
        value = decoded.decode("utf-8")
    except (ValueError, UnicodeError, binascii.Error):
        raise AppError(400, "invalid_cursor", "Invalid pagination cursor.") from None
    if kind == "attempt" and (not value.isascii() or not value.isdecimal() or len(value) > 20):
        raise AppError(400, "invalid_cursor", "Invalid pagination cursor.")
    if kind == "user" and (len(value) > 64 or not value.isascii()):
        raise AppError(400, "invalid_cursor", "Invalid pagination cursor.")
    return value


def add_batch(db: Session, actor: User, events: list[AttemptInput]) -> BatchResponse:
    if actor.role == "guest":
        raise AppError(403, "forbidden", "Access denied.")
    repository.lock_user_writes(db, actor.id)
    accepted: list[str] = []
    duplicates: list[str] = []
    conflicts: list[str] = []
    for event in events:
        payload = event.model_dump(mode="json", by_alias=True)
        digest = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
        ).hexdigest()
        inserted = repository.insert_if_absent(
            db,
            {
                "user_id": actor.id,
                "event_id": event.id,
                "mode": event.mode,
                "question_id": event.question_id,
                "content_version": event.content_version,
                "occurred_at": event.occurred_at,
                "is_correct": event.is_correct,
                "payload": payload,
                "payload_hash": digest,
            },
        )
        if inserted:
            accepted.append(event.id)
        else:
            existing = repository.get_by_event_id(db, actor.id, event.id)
            if existing is None or existing.payload_hash != digest:
                conflicts.append(event.id)
            else:
                duplicates.append(event.id)
    if conflicts:
        db.rollback()
        raise AppError(
            409,
            "idempotency_conflict",
            "An event ID was reused with different content.",
            details={"eventIds": sorted(set(conflicts))},
        )
    db.commit()
    return BatchResponse(accepted=accepted, duplicates=duplicates)


def list_events(
    db: Session, actor: User, owner_id: UUID, cursor: str | None, limit: int
) -> AttemptPage:
    if actor.role == "guest":
        raise AppError(403, "forbidden", "Access denied.")
    _require_owner(actor, owner_id)
    if owner_id != actor.id and repository.get_user(db, owner_id) is None:
        raise AppError(404, "not_found", "Account not found.")
    after = int(_decode_cursor(cursor, "attempt"))
    page = repository.list_for_user(db, owner_id, after, limit)
    return AttemptPage(
        items=[
            AttemptItem(
                event=EVENT_ADAPTER.validate_python(row.payload),
                server_seq=row.server_seq,
                received_at=row.received_at,
            )
            for row in page
        ],
        next_cursor=_encode_cursor(str(page[-1].server_seq)) if page else None,
    )


def stats(db: Session, actor: User, owner_id: UUID | None = None) -> AttemptStats:
    if actor.role == "guest":
        raise AppError(403, "forbidden", "Access denied.")
    if owner_id is None:
        _require_admin(actor)
    else:
        _require_owner(actor, owner_id)
    counts = repository.mode_counts(db, owner_id)
    return AttemptStats(
        total_attempts=sum(total for _, total, _ in counts),
        correct_attempts=sum(correct for _, _, correct in counts),
        by_mode=[
            ModeStats(mode=mode, total_attempts=total, correct_attempts=correct)
            for mode, total, correct in counts
        ],
    )


def progression(db: Session, actor: User) -> Progression:
    if actor.role in ("guest", "tester"):
        raise AppError(403, "forbidden", "Access denied.")
    counts = repository.mode_counts(db, actor.id)
    total = sum(item[1] for item in counts)
    correct = sum(item[2] for item in counts)
    rank_index = max(index for index, (_, _, threshold) in enumerate(RANKS) if correct >= threshold)
    rank_id, title, minimum = RANKS[rank_index]
    next_rank_at = RANKS[rank_index + 1][2] if rank_index + 1 < len(RANKS) else None
    now = datetime.now(UTC)
    start_day = now.date() - timedelta(days=29)
    since = datetime.combine(start_day, time.min, UTC)
    daily = {
        day: (total_count, correct_count)
        for day, total_count, correct_count in repository.daily_counts(db, actor.id, since)
    }
    trend = [
        DailyTrend(
            day=(start_day + timedelta(days=index)).isoformat(),
            total_attempts=daily.get(start_day + timedelta(days=index), (0, 0))[0],
            correct_attempts=daily.get(start_day + timedelta(days=index), (0, 0))[1],
        )
        for index in range(30)
    ]
    return Progression(
        total_attempts=total,
        correct_attempts=correct,
        accuracy=round(100 * correct / total, 1) if total else 0.0,
        rank=Rank(
            id=rank_id,
            title=title,
            minimum_correct_attempts=minimum,
            next_rank_at=next_rank_at,
        ),
        trend=trend,
    )


def users_page(db: Session, actor: User, cursor: str | None, limit: int) -> AdminUserPage:
    _require_admin(actor)
    after = _decode_cursor(cursor, "user")
    rows = repository.list_users(db, after, limit)
    page = rows[:limit]
    return AdminUserPage(
        items=[
            AdminUser(
                id=row.id,
                username=row.username,
                email=row.email,
                display_name=row.display_name,
                role=row.role,
                is_active=row.is_active,
                created_at=row.created_at,
                last_login_at=row.last_login_at,
            )
            for row in page
        ],
        next_cursor=_encode_cursor(page[-1].username) if len(rows) > limit else None,
    )
