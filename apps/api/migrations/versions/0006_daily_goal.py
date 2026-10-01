"""Add optional per-account daily answer goal.

Revision ID: 0006_daily_goal
Revises: 0005_progress_generation

The nullable column is compatible with the previous application version.
Downgrading removes saved goals; back up account settings before rollback.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_daily_goal"
down_revision: str | None = "0005_progress_generation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("daily_goal", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_users_daily_goal", "users", "daily_goal IS NULL OR daily_goal BETWEEN 1 AND 500"
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_daily_goal", "users", type_="check")
    op.drop_column("users", "daily_goal")
