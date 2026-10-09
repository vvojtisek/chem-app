"""Mark invitation tokens and remove pending self-registrations (ADR 0013).

Revision ID: 0007_admin_invites
Revises: 0006_daily_goal

The new column has a server default, so the previous application version can
still insert reset tokens. Pending self-registrations can no longer be
completed and are deleted; their verification tokens and queued mail cascade.
Downgrading drops the column but does not restore deleted registrations.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_admin_invites"
down_revision: str | None = "0006_daily_goal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "password_reset_tokens",
        sa.Column("purpose", sa.String(16), nullable=False, server_default="reset"),
    )
    op.create_check_constraint(
        "ck_password_reset_tokens_purpose",
        "password_reset_tokens",
        "purpose IN ('reset', 'invite')",
    )
    op.execute(
        sa.text(
            "DELETE FROM users WHERE role = 'user' AND is_active = false"
            " AND email_verified_at IS NULL"
            " AND password_hash = '!pending-email-verification'"
        )
    )


def downgrade() -> None:
    op.drop_constraint("ck_password_reset_tokens_purpose", "password_reset_tokens", type_="check")
    op.drop_column("password_reset_tokens", "purpose")
