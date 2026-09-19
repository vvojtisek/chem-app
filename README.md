# Inorganic chemistry learning application

Offline-capable Czech learning application for periodic-table practice, chemical equations, inorganic nomenclature, and occurrence/production review.

## Repository

- `apps/web` — Next.js App Router PWA
- `apps/api` — FastAPI service and PostgreSQL persistence boundary
- `packages/chemistry` — pure deterministic chemistry logic
- `packages/contracts` — generated OpenAPI TypeScript types
- `packages/ui` — accessible React primitives
- `content` — reviewed curriculum authoring data and validators
- `docs` — product, architecture, contracts, security, testing, and ADRs

Read `AGENTS.md` and the nested instruction file for the area being changed before editing.

## Prerequisites

- Node.js 24
- pnpm 11.7.0
- Python 3.12 or newer
- `uv` 0.12 or newer
- Docker with Compose for local PostgreSQL

## Install

```bash
pnpm install --frozen-lockfile
uv --directory apps/api sync --frozen --extra test
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

The copied `.env` is local-only and must not be committed.

## Local development

Start PostgreSQL:

```bash
pnpm db:up
```

Run the API in one terminal:

```bash
pnpm dev:api
```

Run the web application in another:

```bash
pnpm dev:web
```

The web application is served at `http://localhost:3000`; API documentation is available at `http://localhost:8000/docs` during local development.

## Generated API contracts

FastAPI OpenAPI is canonical. After an API schema change, regenerate and verify the committed artifacts:

```bash
pnpm contracts:generate
pnpm contracts:check
```

Do not edit `packages/contracts/openapi.json` or `packages/contracts/src/schema.d.ts` manually.

## Quality gate

Run the full gate documented in `docs/testing.md` before declaring a change complete:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
pnpm contracts:check
uv --directory apps/api run ruff format --check .
uv --directory apps/api run ruff check .
uv --directory apps/api run pytest -q
pnpm build
pnpm test:e2e
```

Chemistry-content changes additionally require SME review; passing validation alone is not approval.
