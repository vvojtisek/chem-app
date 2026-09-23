# Inorganic chemistry learning application

Offline-capable Czech learning application for periodic-table practice, chemical equations, inorganic nomenclature, and occurrence/production review.

## Repository

- `apps/web` — Next.js App Router PWA
- `apps/api` — FastAPI service and PostgreSQL persistence boundary
- `packages/chemistry` — pure deterministic chemistry logic
- `packages/contracts` — generated OpenAPI TypeScript types
- `packages/ui` — accessible React primitives
- `content` — reviewed curriculum authoring data and validators
- `docs` — product, architecture, contracts, security, testing, deployment, and ADRs

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

To refresh and restart the local stack in one command, run `pnpm local:update` from the repository. It updates the currently checked-out branch from its tracking branch using fast-forward only, syncs locked dependencies, starts the local database, builds the current checkout, and runs the API and frontend on ports 8000 and 3000. Press Ctrl+C to stop the API and frontend; the database keeps running. It refuses to merge incoming commits over uncommitted changes and never switches branches. In Codex, select **Update local app** from the `/` menu or invoke `$update`; this workflow is only installed in this repository.

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

## Production deployment

The public single-origin Docker Compose deployment, DNS/TLS prerequisites,
first account provisioning, upgrades, and backup recovery are documented in
[`docs/deployment.md`](docs/deployment.md).

## Nomenclature authoring and practice

The `/procvicovani/nazvoslovi` route reads `content/generated/nomenclature-runtime.json`. `content/data/nomenclature.json` holds 510 records from two content-owner seeds, and 469 are available for practice. From the first seed (126 entries), the owner released 86 core entries on 2026-09-23 after a cursory check; 40 remain drafts with unresolved review or scope decisions. The second seed (472 entries, stated by the owner to be verified from VŠCHT materials) added 383 released entries and one held for review; 86 of its keys already existed and two were omitted ([release ledger](docs/exec-plans/active/nomenclature-seed-2-review.md)). Both releases are owner authorizations: `owner-approved` is deliberately distinct from `reviewed` (chemistry-SME review). At the owner's request the practice screen no longer shows that distinction, so `reviewLevel` must stay accurate in the data. Each record offers one or both question directions, 812 prompts in total.

The first seed is a user-provided conversion of online [VŠCHT Praha nomenclature materials](https://e-learning.vscht.cz/echo/anorganika/nazvoslovi/index.html). Its formula/name pairs were compared with the [VŠCHT ECHO index](https://e-learning.vscht.cz/echo/anorganika/nazvoslovi/indexes/namesIndex.html): 59 of the released pairs match exactly; 26 do not appear there, and the index spells `NH4Cl` differently from the supplied name. [Other VŠCHT material](https://old.vscht.cz/fch/prikladnik/prikladnik/tab/termod.html) supports the supplied `NH4Cl` spelling. The ECHO project states a [CC BY-NC-ND 3.0 CZ license](https://e-learning.vscht.cz/echo/index.html); keep source attribution and review reuse terms before redistributing the underlying material outside this project.

After editing the authoring data, run:

```bash
pnpm --dir content import:nomenclature
pnpm --dir content import:nomenclature-2
pnpm --dir content generate:nomenclature
pnpm content:validate
```

The import commands report missing records without writing; `--write` adds them while preserving existing edits. The second importer follows the per-entry [decisions file](docs/exec-plans/active/nomenclature-seed-2-decisions.json). Both refuse a changed seed archive so source changes require a deliberate review. Generation and validation fail on invalid published content or a stale generated snapshot. A chemistry reviewer must verify each formula, Czech name, explanation, difficulty, context, and alias against traceable sources, resolve findings, and record reviewer and date before changing an entry to `reviewed`. Local practice and attempt history use IndexedDB; an unavailable store is reported in the UI. The IndexedDB schema is version 4, so a production rollout must first retire older clients that delete databases on `VersionError`.
