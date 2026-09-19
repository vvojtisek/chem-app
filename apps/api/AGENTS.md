# API application instructions

These instructions apply to `apps/api`. Read the repository-root `AGENTS.md`, `docs/architecture.md`, `docs/api-contracts.md`, `docs/security.md`, `docs/testing.md`, and accepted backend ADRs first.

## Layering

Keep dependencies flowing inward:

1. routers handle HTTP concerns and dependency injection;
2. Pydantic request/response schemas define transport validation;
3. services implement application use cases and authorization decisions;
4. repositories expose persistence operations;
5. SQLAlchemy models and database adapters remain infrastructure details.

Routers must not contain queries or business workflows. Repositories must not return HTTP responses or raise FastAPI exceptions. Translate domain/application errors to the documented API envelope at the transport boundary.

## FastAPI and Pydantic

- Use Pydantic v2 models for every external request and response.
- Set explicit response models and stable, unique `operation_id` values.
- Reject unknown fields on security-sensitive inputs unless forward compatibility explicitly requires them.
- Validate at the boundary, then pass typed values inward. Do not pass raw request dictionaries through the service layer.
- Keep dependency providers narrow. Do not use global mutable service or session objects.
- Use UTC-aware timestamps and serialize them as RFC 3339.
- Publish OpenAPI in CI and regenerate `packages/contracts` when the contract changes.

## Persistence and migrations

- Use SQLAlchemy 2.x directly; do not mix SQLModel and SQLAlchemy declarative models in the same application.
- Keep Pydantic schemas separate from ORM models.
- Use one database session per request or background unit of work. Commit at an explicit application boundary.
- Avoid hidden lazy loading in response serialization; load required relationships intentionally.
- Use Alembic for every schema change. Never edit a migration that may have been applied.
- Migrations must address deployment order, rollback or roll-forward recovery, and compatibility with the previous application version.
- Deterministic seed operations must be idempotent. Reviewed curriculum files remain the chemistry-content source of truth.

## Authentication and authorization

- Authentication establishes identity; each service operation must still enforce authorization for the target resource.
- Never trust a user ID, role, ownership flag, or mastery score merely because the client submitted it.
- If browser sessions use cookies, require `Secure`, `HttpOnly`, and an appropriate `SameSite` policy and implement CSRF protection for state-changing requests.
- If bearer tokens are used, validate issuer, audience, expiry, and signature server-side. Do not log tokens.
- Use generic authentication failures where extra detail would disclose whether an account exists.

## API behavior

- Follow `docs/api-contracts.md` for versioning, pagination, errors, and idempotency.
- Do not expose ORM objects directly. Map explicitly to response models.
- Use semantic status codes and document non-success responses in OpenAPI.
- Add stable client operation IDs to retryable offline mutations and enforce idempotency in the service/persistence layer.
- Put slow or failure-prone integrations behind adapters with timeouts and deterministic error translation.
- Do not perform unbounded list queries or accept unbounded payload collections.

## Chemistry boundary

The API may validate transport shape, ownership, sync ordering, and content-version references. It must not grow an independent chemistry parser or accept arbitrary client-authored curriculum as reviewed content. If authoritative server-side chemistry grading becomes necessary, record a cross-language strategy in an ADR before implementing it.

## Python quality and tests

- Use Python type annotations for production and test helpers where they improve clarity.
- Use `uv` and the committed `uv.lock`; do not document or create a manual `venv` workflow.
- Use Ruff for formatting and linting and Pytest for unit and integration tests.
- Test services independently from HTTP and persistence where practical.
- API integration tests must exercise the real error envelope, authorization failures, transaction behavior, and OpenAPI schema.
- Use isolated test databases. Tests must not depend on execution order or a developer's local database.
- Run the backend commands in `docs/testing.md`; report anything not run.

## Completion checks

Before completion, confirm that migrations and compatibility notes accompany schema changes, OpenAPI and generated clients are current, authorization has negative tests, exceptions do not leak internals, and all relevant backend checks pass.
