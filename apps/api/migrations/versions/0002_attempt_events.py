"""Add append-only attempt history.

Revision ID: 0002_attempt_events
Revises: 0001_accounts_and_sessions

Additive migration: the previous API can run while this table is present. Roll
back only before accepting attempts, since downgrade drops their history.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_attempt_events"
down_revision: str | None = "0001_accounts_and_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attempt_events",
        sa.Column("server_seq", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("mode", sa.String(32), nullable=False),
        sa.Column("question_id", sa.String(256), nullable=False),
        sa.Column("content_version", sa.String(128), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
    )
    op.create_index("ix_attempt_events_user_seq", "attempt_events", ["user_id", "server_seq"])
    op.create_index(
        "uq_attempt_events_user_event_id", "attempt_events", ["user_id", "event_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index("uq_attempt_events_user_event_id", table_name="attempt_events")
    op.drop_index("ix_attempt_events_user_seq", table_name="attempt_events")
    op.drop_table("attempt_events")
