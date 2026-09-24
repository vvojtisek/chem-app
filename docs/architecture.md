# Current architecture

## Status and scope

This document describes the accepted target architecture for the first implementation. ADRs in `docs/decisions/` explain why major choices were made and take precedence if this summary becomes stale.

## Repository layout

```text
apps/
  web/                 Next.js App Router application and PWA
  api/                 FastAPI HTTP API and persistence orchestration
packages/
  chemistry/           Pure TypeScript chemistry and answer-evaluation domain
  contracts/           OpenAPI-generated TypeScript client and contract artifacts
  ui/                  Reusable accessible React presentation primitives
content/               Reviewed authoring sources and generated curriculum snapshots
docs/                  Product, architecture, contracts, security, and plans
```

The JavaScript/TypeScript workspace uses pnpm. Python dependencies and commands use `uv` with a committed lockfile for `apps/api`.

## Components and dependencies

```mermaid
flowchart LR
    Author[Reviewed content sources] --> Validate[Schema and chemistry validation]
    Chemistry[packages/chemistry] --> Validate
    Validate --> Snapshot[Versioned curriculum snapshot]
    Snapshot --> Web[apps/web]
    Snapshot --> API[apps/api]
    UI[packages/ui] --> Web
    OpenAPI[FastAPI OpenAPI] --> Contracts[packages/contracts]
    Contracts --> Web
    Web <--> Browser[(IndexedDB and service-worker cache)]
    Web <--> API
    API <--> DB[(PostgreSQL)]
```

Allowed dependency direction:

- `apps/web` may depend on `packages/ui`, `packages/contracts`, `packages/chemistry`, and generated reviewed content.
- `apps/api` depends on its own application/domain interfaces and persistence adapters. It publishes OpenAPI but does not import frontend packages.
- `packages/chemistry` depends on neither application and has no I/O.
- `packages/contracts` is generated from OpenAPI; application code does not hand-edit generated files.
- `content` contains data and authoring metadata, not runtime application logic.

Circular dependencies and imports between `apps/web` and `apps/api` are forbidden.

## Runtime data flow

### Curriculum and grading

1. Authors edit structured records under `content/` with sources and review metadata.
2. Validation checks schema, IDs, references, formula parsing, equation balance, aliases, and review status.
3. The build emits a versioned runtime snapshot containing only publishable, non-deprecated records. For nomenclature, owner-approved records are marked separately from SME-reviewed records. The nomenclature snapshot (`schemaVersion: 3`) carries each record's practice category, ion charge, derived element count (distinct element symbols in the formula), and, for salts, the anion family used by quick filters.
4. The PWA caches that snapshot for offline use.
5. Exercise selection and answer evaluation execute locally through pure `packages/chemistry` functions.

The API may distribute the same snapshot and record progress, but it is not the sole source of curriculum. The server does not maintain a separate chemistry implementation.

### Authentication and accounts

All web routes require a pre-provisioned local account. FastAPI stores Argon2id
password hashes and opaque server-side sessions in PostgreSQL. The browser
receives only a secure HttpOnly session cookie and a separate CSRF cookie;
mutations validate CSRF and same-origin requests. Roles are `admin`, `user`,
and `tester`; ownership and role checks happen in API services. See ADR 0005.

The Next.js proxy checks only for the presence of the session cookie and is a
navigation convenience. API authentication remains authoritative. A small
account marker in localStorage permits opening the cached shell after prior
verification while offline; it grants no API access and is not a security
boundary for device-local data.

### Progress and synchronization

1. A completed answer creates an immutable local attempt event with a stable client event ID, content version, round, learning mode, answer direction, and match policy. The browser store validates every event against one Zod schema that lists the allowed mode, direction, and match-policy combinations: an invalid event is rejected when written and skipped when read. Typed periodic-table answers are recorded as `name-to-symbol` / `symbol-exact` (Czech name shown, symbol typed) or `symbol-to-name` / `diacritics-tolerant` (symbol shown, Czech name typed). Earlier `position-to-name-or-symbol` / `name-tolerant-or-symbol-exact` and name-only `position-to-name` / `diacritics-tolerant` periodic-table events, and `element-name` events from the former `/procvicovani/prvky` series, are no longer written but stay readable unchanged. A new combination needs no IndexedDB version change. An older client that does not know it skips those events when reading but never deletes them, and they become readable again after upgrading, so no reset is needed.
2. The UI updates local session state and derived mastery immediately, even while offline.
3. After authentication and while online, a sync worker sends pending events through the generated client.
4. The API enforces identity, ownership, schema, idempotency, and ordering, then persists accepted events in PostgreSQL.
5. A successful acknowledgement removes the event from the pending queue. Retryable failure keeps it queued; permanent rejection is visible and recoverable.

The application does not use last-write-wins for immutable attempt events.
Legacy v4 attempts are imported only after an explicit user choice and are
removed from the legacy database only after a successful copy. Checkpoints,
flashcard edits, and other learning state remain local. User preferences that
can conflict need an explicit version or updated timestamp and a documented
resolution rule.

## Rendering and state ownership

- Next.js Server Components provide route shells and online server-rendered content where useful.
- Core exercise interactions are small Client Component islands because they require browser state, input, IndexedDB, and offline operation.
- TanStack Query owns remote server state in Client Components.
- IndexedDB owns cached curriculum, local attempts, pending synchronization, and spaced-repetition records.
- The initial `Prvky` flashcard route reads reviewed element and named-group records from `@inorganic/content/runtime`. Locally edited or user-added cards are stored separately in IndexedDB and overlay the reviewed records only in that browser; they never mutate authored curriculum.
- `localStorage` is limited to small, non-sensitive startup preferences. The periodic-table exercises share one element selection under `selected_pt_elements`; the name practice keeps its mode under `inorganic.periodic-table-name-practice.mode`. Each value is a Zod-validated object with `schemaVersion: 1`. A selection saved under the former `inorganic.periodic-table-name-practice.selection` key is moved to the shared key on first read. Unknown element IDs are dropped on read; a missing, corrupt, or unknown-version value, or blocked storage, falls back to the defaults (groups 1–18 without the bottom rows, Název → Značka) without an error.
- React component state owns transient UI state that need not survive navigation.
- Nomenclature practice pins its queue (current, remaining, solved and missed record IDs), counters, elapsed time, and filters in an IndexedDB checkpoint with `checkpointVersion: 2`. Attempts are written atomically with each checkpoint transition, and the final attempt of a finished or ended practice is written together with the checkpoint removal. A content-version mismatch or a series saved by the earlier series-based version (checkpoint without a version) ends the practice with a notice and removes the checkpoint; attempt history is never deleted. A checkpoint that cannot be read offers an explicit removal. Nomenclature filters and the answer direction are small startup preferences in `localStorage` (`inorganic.nomenclature.filters`, `inorganic.nomenclature.direction`, each with `schemaVersion: 1` and Zod validation; invalid values fall back to defaults). Typed names are recorded as `formula-to-name` / `name-lenient`, with the match `normalized` for answers accepted only after lenient normalization. This increment is browser-local; server synchronization remains future work.

Do not mirror one category into another without a specific synchronization contract.

## Offline and update model

Core learning routes, required assets, the application shell, and a reviewed curriculum snapshot are precached or made available through an explicit runtime policy. Authenticated API responses are not placed in a shared service-worker cache.

Every persisted database and browser-store format has a schema version. The application migrates compatible data transactionally. If migration cannot be safe, it offers an explicit export/reset or recoverable reset path instead of failing to render.

Application and curriculum versions are independent. A new application may read declared older curriculum versions; unsupported combinations show a clear update/recovery state.

## Deployment model

- The web application and API deploy independently but share a compatibility-tested HTTP contract.
- PostgreSQL is private to the API.
- Database schema changes use Alembic and support rolling application deployment where possible.
- Static/runtime curriculum artifacts are content-addressed or versioned so service-worker updates cannot combine incompatible files silently.
- Configuration comes from validated environment variables; secrets are injected by the deployment platform.
- The public deployment uses one HTTPS origin with Caddy routing `/api/*` to
  FastAPI and other paths to Next.js. PostgreSQL is private, and migrations
  complete before the API accepts traffic. See `docs/deployment.md`.

## Future change rules

Changes to frameworks, database/ORM, API style, authentication architecture, offline persistence, or the canonical chemistry runtime require an ADR. Update this document in the same change once an ADR is accepted.
