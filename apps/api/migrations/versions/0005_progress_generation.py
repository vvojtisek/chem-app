"""Add per-account progress generation for explicit learning-progress reset.

Revision ID: 0005_progress_generation
Revises: 0004_mail_outbox

Existing attempts belong to generation zero. Rollback removes the reset barrier;
never downgrade after a user has reset progress without a recovery plan.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_progress_generation"
down_revision: str | None = "0004_mail_outbox"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "progress_generation",
            sa.Uuid(),
            nullable=False,
            server_default="00000000-0000-0000-0000-000000000000",
        ),
    )
    op.add_column(
        "attempt_events",
        sa.Column(
            "progress_generation",
            sa.Uuid(),
            nullable=False,
            server_default="00000000-0000-0000-0000-000000000000",
        ),
    )
    op.create_index(
        "ix_attempt_events_user_generation_seq",
        "attempt_events",
        ["user_id", "progress_generation", "server_seq"],
    )


def downgrade() -> None:
    op.drop_index("ix_attempt_events_user_generation_seq", table_name="attempt_events")
    op.drop_column("attempt_events", "progress_generation")
    op.drop_column("users", "progress_generation")
