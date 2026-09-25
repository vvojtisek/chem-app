from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from inorganic_api.database import Base


class AttemptEvent(Base):
    __tablename__ = "attempt_events"

    server_seq: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    question_id: Mapped[str] = mapped_column(String(256), nullable=False)
    content_version: Mapped[str] = mapped_column(String(128), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    progress_generation: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=False, server_default="00000000-0000-0000-0000-000000000000"
    )

    __table_args__ = (
        Index("ix_attempt_events_user_seq", "user_id", "server_seq"),
        Index("uq_attempt_events_user_event_id", "user_id", "event_id", unique=True),
    )
