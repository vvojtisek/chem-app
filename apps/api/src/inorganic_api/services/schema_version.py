# Alembic revisions in the order they are applied. Append each new migration's
# revision; tests/test_health.py fails if this list and migrations/ disagree.
MIGRATION_REVISIONS: tuple[str, ...] = (
    "0001_accounts_and_sessions",
    "0002_attempt_events",
    "0003_account_self_service",
    "0004_mail_outbox",
    "0005_progress_generation",
    "0006_daily_goal",
    "0007_admin_invites",
)


def is_schema_ready(database_revision: str | None) -> bool:
    """Whether this code can run against a database at ``database_revision``.

    A database behind this code is missing tables or columns the code uses. A
    revision this code does not know comes from a newer release; migrations stay
    compatible with the previous release (ADR 0012), so that is accepted.
    """
    if database_revision is None:
        return False
    if database_revision not in MIGRATION_REVISIONS:
        return True
    return database_revision == MIGRATION_REVISIONS[-1]
