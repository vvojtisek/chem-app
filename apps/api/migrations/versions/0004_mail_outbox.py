"""Queue account links for delivery outside HTTP requests.

Revision ID: 0004_mail_outbox
Revises: 0003_account_self_service

The table is additive and can be created before updating the API. Keep the
worker stopped until the new API and web verification flow are deployed. A
downgrade discards pending mail, so drain the queue before rolling back.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_mail_outbox"
down_revision: str | None = "0003_account_self_service"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mail_outbox",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("recipient", sa.String(254), nullable=False),
        sa.Column("encrypted_token", sa.String(512), nullable=False),
        sa.Column(
            "verification_token_id",
            sa.Uuid(),
            sa.ForeignKey("email_verification_tokens.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "reset_token_id",
            sa.Uuid(),
            sa.ForeignKey("password_reset_tokens.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("leased_until", sa.DateTime(timezone=True)),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint(
            "(verification_token_id IS NOT NULL) <> (reset_token_id IS NOT NULL)",
            name="ck_mail_outbox_one_token",
        ),
    )
    op.create_index("ix_mail_outbox_next_attempt_at", "mail_outbox", ["next_attempt_at"])


def downgrade() -> None:
    op.drop_index("ix_mail_outbox_next_attempt_at", table_name="mail_outbox")
    op.drop_table("mail_outbox")
