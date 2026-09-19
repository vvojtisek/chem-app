# ADR 0002: Use FastAPI, Pydantic, and SQLAlchemy for the API

- Status: Accepted
- Date: 2026-09-19
- Decision owners: Engineering

## Context

Optional accounts and cross-device progress synchronization require an HTTP service and persistent database. The web client needs a machine-readable contract without maintaining duplicate TypeScript and Python DTOs. The project also needs an explicit choice between SQLModel and SQLAlchemy to avoid mixed patterns.

## Decision

Use FastAPI in `apps/api`, with:

- Pydantic v2 for HTTP request/response validation;
- SQLAlchemy 2.x declarative models and repositories for PostgreSQL access;
- Alembic for migrations;
- Pytest for tests and Ruff for formatting/linting;
- `uv` plus a committed `apps/api/uv.lock` for Python dependency management;
- generated OpenAPI as the canonical HTTP contract and the source for `packages/contracts`.

Do not use SQLModel in the initial architecture. Pydantic transport models and SQLAlchemy persistence models remain separate and are mapped explicitly.

## Consequences

### Positive

- FastAPI publishes OpenAPI directly from validated models and route declarations.
- Explicit model separation avoids coupling HTTP representation to database schema.
- SQLAlchemy offers mature PostgreSQL and migration integration without mixing ORM styles.
- Generated clients reduce contract drift.

### Negative and mitigations

- Explicit mapping adds code. Keep mappers small and test meaningful transformations.
- Python and TypeScript cannot share the chemistry runtime directly. The offline client performs canonical grading; the API handles transport, identity, idempotency, and persistence. Authoritative server grading would require a new ADR.
- Generated clients create review noise. Generation must be deterministic and checked in CI.

## Revisit when

Revisit if server-side authoritative chemistry evaluation becomes a hard requirement, the service requires a different concurrency model, or SQLAlchemy materially fails measured needs. Any replacement requires a superseding ADR and migration/contract plan.
