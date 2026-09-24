"""Add verified email accounts, guest role, and one-time account tokens.

Revision ID: 0003_account_self_service
Revises: 0002_attempt_events

Additive columns and tables allow the previous API to run during rollout. The
role check is widened before guest sessions are created. Downgrade is safe only
before public accounts or reset/verification tokens are created.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_account_self_service"
down_revision: str | None = "0002_attempt_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _token_table(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
    )
    op.create_index(f"ix_{name}_user_id", name, ["user_id"])


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(254)))
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("display_name", sa.String(80)))
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role", "users", "role IN ('admin', 'user', 'tester', 'guest')"
    )
    _token_table("password_reset_tokens")
    _token_table("email_verification_tokens")


def downgrade() -> None:
    op.drop_index("ix_email_verification_tokens_user_id", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_index("ix_password_reset_tokens_user_id", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
    op.execute(
        "DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'guest')"
    )
    op.execute("DELETE FROM users WHERE role = 'guest'")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint("ck_users_role", "users", "role IN ('admin', 'user', 'tester')")
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_column("users", "display_name")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "email")
