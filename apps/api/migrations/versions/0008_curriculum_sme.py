"""Let administrators mark any account as a chemistry SME (ADR 0014 amendment).

Revision ID: 0008_curriculum_sme
Revises: 0007_admin_invites

The flag has a server default and both profile columns are nullable, so the
previous application version keeps working against the upgraded schema.
Downgrading drops the columns; reviews already committed to the content
repository keep their reviewer entries.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_curriculum_sme"
down_revision: str | None = "0007_admin_invites"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("curriculum_sme", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("users", sa.Column("sme_public_name", sa.String(120)))
    op.add_column("users", sa.Column("sme_qualification", sa.String(300)))


def downgrade() -> None:
    op.drop_column("users", "sme_qualification")
    op.drop_column("users", "sme_public_name")
    op.drop_column("users", "curriculum_sme")
