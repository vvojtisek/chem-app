# AGENTS.md

## Purpose

This repository contains an offline-capable learning application for inorganic chemistry.

Agents working in this repository must optimize for:

1. chemical correctness;
2. predictable and maintainable architecture;
3. strict type safety;
4. accessibility and responsive UX;
5. offline resilience;
6. automated verification;
7. small, reviewable changes.

Do not trade correctness for delivery speed.

---

## Sources of truth

Before making architectural or cross-cutting changes, read the relevant repository documentation.

Primary sources:

- `docs/product-spec.md` — product behavior and learning requirements
- `docs/architecture.md` — system structure and module boundaries
- `docs/chemistry-content.md` — chemistry data and validation rules
- `docs/api-contracts.md` — HTTP/API conventions
- `docs/testing.md` — verification requirements
- `docs/security.md` — security requirements
- `docs/decisions/` — accepted Architecture Decision Records
- `docs/exec-plans/active/` — active implementation plans

If documents conflict:

1. explicit user/task instructions take precedence;
2. accepted ADRs take precedence over older architecture documentation;
3. this `AGENTS.md` takes precedence over general repository documentation for agent behavior;
4. nested `AGENTS.md` files may add or override instructions within their directory scope.

Do not silently resolve a material conflict. Record the resolution in an ADR or explicitly report the conflict.

---

## Product invariants

The application is a Czech-language inorganic chemistry learning product.

The core learning modes are:

- periodic-table practice;
- chemical equations and balancing;
- inorganic nomenclature;
- occurrence, production, and flashcards.

Chemical correctness is a release requirement.

Do not add unreviewed chemistry content merely to meet content-volume targets.

Incorrect chemistry is more severe than missing chemistry.

All user-visible chemistry content must originate from validated structured data rather than being duplicated directly inside UI components.

---

## Architecture

This is a monorepo.

Baseline architecture:

- `apps/web` — Next.js, React, TypeScript, Tailwind CSS
- `apps/api` — FastAPI, Python, Pydantic
- PostgreSQL — persistent server-side storage
- `packages/chemistry` — domain logic independent of UI and transport
- `packages/contracts` — generated or shared API-contract artifacts
- `packages/ui` — reusable presentation components
- `content` — reviewed curriculum source data

Do not introduce another frontend framework or backend runtime without an accepted ADR.

In particular:

- do not introduce Vite as a second application architecture;
- do not introduce Go alongside FastAPI without an ADR replacing the backend architecture;
- do not duplicate domain logic between frontend and backend;
- do not place chemistry validation logic inside React components;
- do not couple domain models directly to persistence models.

Prefer boring, explicit architecture over unnecessary abstraction.

Create abstractions only when at least two real consumers justify them.

---

## Module boundaries

### `apps/web`

May depend on:

- UI packages;
- generated API contracts;
- chemistry presentation helpers;
- browser persistence abstractions.

It must not depend on backend implementation internals.

### `apps/api`

Owns:

- HTTP transport;
- authentication and authorization;
- persistence orchestration;
- server-side validation;
- OpenAPI publication.

It must not contain frontend concerns.

### `packages/chemistry`

Owns pure chemistry/domain behavior such as:

- formula parsing;
- formula normalization;
- atom counting;
- equation validation;
- coefficient reduction;
- answer normalization;
- nomenclature rules;
- mastery calculations where independent of persistence.

Keep this package deterministic and easy to unit test.

### `content`

Contains curriculum data, not application logic.

Every record must have:

- a stable ID;
- schema validation;
- referential integrity where applicable;
- review metadata in the authoring source;
- deterministic validation.

---

## TypeScript

TypeScript strict mode is mandatory.

Do not use:

- `any` unless interacting with an unavoidable untyped boundary;
- unchecked type assertions to silence compiler errors;
- `@ts-ignore` without a documented reason;
- duplicated manually maintained API DTO types.

Prefer:

- `unknown` followed by validation;
- discriminated unions;
- readonly data where mutation is unnecessary;
- exhaustive `switch` handling;
- explicit domain types for identifiers and constrained values.

Use Zod at untrusted runtime boundaries where client-side validation is required.

Compile-time TypeScript types are not runtime validation.

---

## Python

Use type annotations for production Python code.

Use:

- Pydantic for API input/output validation;
- Ruff for formatting and linting;
- Pytest for testing.

Do not disable type, lint, or validation rules merely to make CI pass.

Use narrow exception handling.

Do not catch `Exception` unless the boundary genuinely requires it and the error is subsequently logged, translated, or re-raised appropriately.

---

## API contracts

The FastAPI OpenAPI specification is the canonical HTTP contract.

Generate frontend API types/client bindings from OpenAPI where practical.

Do not maintain equivalent request/response interfaces independently in Python and TypeScript.

All JSON API errors must use one documented error envelope.

An error response should provide machine-readable information such as:

```json
{
  "error": {
    "code": "invalid_answer",
    "message": "Human-readable description",
    "details": {}
  }
}
```

Use HTTP status codes semantically.

Do not return HTTP `200` for failed operations.

Validate all input at the service boundary.

Do not expose internal exceptions, SQL errors, stack traces, secrets, or infrastructure details to clients.

---

## Data and migrations

Database schema changes must use migrations.

Never modify an existing migration that may already have been applied.

Every schema-changing PR must include:

- migration;
- model changes;
- relevant tests;
- rollback or backward-compatibility consideration.

Seed data must be deterministic and idempotent where possible.

Curriculum content and database seed data are different concepts. Do not make PostgreSQL the only source of chemistry curriculum content unless an ADR explicitly changes the content architecture.

---

## Offline behavior

Offline capability is a product requirement, not an optional enhancement.

Network failure must not turn the application into a blank or unusable screen.

Clearly distinguish:

- server state;
- browser-local state;
- cached curriculum;
- unsynchronized changes.

Do not assume that a network connection exists.

Offline persistence must be versioned and migrations must be testable.

If changing persistence format, provide a migration or an explicit recoverable reset path.

---

## State management and data fetching

Prefer React Server Components where they provide a clear benefit.

Use Client Components only when browser state, interaction, or browser APIs require them.

Use TanStack Query for asynchronous client-side server state.

Do not copy server state into a second global store without a concrete reason.

Keep transient component state local.

Query keys must be deterministic and centrally structured.

Mutation success must invalidate or update the relevant cached state explicitly.

Do not hide cache invalidation inside unrelated UI components.

---

## UI and UX

Design should be clean, restrained, responsive, and content-first.

Use an Apple-inspired level of visual simplicity, not imitation of Apple branding.

Use Tailwind CSS consistently.

Prefer reusable primitives and composition over large one-off components.

Avoid:

- oversized decorative UI;
- unnecessary gradients;
- excessive animation;
- inconsistent spacing;
- decorative controls without semantic meaning.

Every core interaction must work with:

- mouse;
- keyboard;
- touch.

Accessibility target: WCAG 2.2 AA for core flows.

Do not rely on color alone to communicate correctness, mastery, errors, or state.

Minimum supported narrow layout must remain usable at 360 px.

---

## Chemistry-specific correctness

Chemistry calculations and answer evaluation must be deterministic.

Important behavior requires positive and negative fixtures.

Examples include:

- formula normalization;
- hydrate notation;
- diacritics handling;
- coefficient normalization;
- lowest-whole-number equation ratios;
- atom conservation;
- acceptable nomenclature aliases;
- invalid but superficially similar answers.

“Tolerant” answer matching must never become fuzzy semantic guessing.

Only explicitly approved equivalent answers may be accepted.

Reaction equations stored as content must pass automated atom-balance validation.

Content involving industrial conditions, catalysts, temperatures, pressures, nomenclature, or nontrivial chemical facts requires SME review before being marked releasable.

---

## Naming

Use meaningful English names in source code.

Repository and general file naming follows lowercase, hyphenated, versionless naming where the platform or language does not impose another convention.

Examples:

- `answer-normalizer.ts`
- `periodic-table-grid.tsx`
- `reaction-validator.test.ts`
- `chemistry-content.md`

Language conventions override filename conventions where required.

Python modules use `snake_case.py`.

Identifiers:

- TypeScript variables/functions: `camelCase`
- TypeScript types/classes/components: `PascalCase`
- Python functions/variables/modules: `snake_case`
- Python classes: `PascalCase`
- database tables/columns: `snake_case`
- environment variables: `UPPER_SNAKE_CASE`

Avoid abbreviations unless they are established domain terms.

Names should describe intent, not implementation mechanics.

---

## Code quality

Use Biome for supported TypeScript/JavaScript formatting and linting.

Use Ruff for Python formatting and linting.

Do not manually reformat unrelated files.

Do not perform opportunistic refactoring in a feature or bug-fix PR.

Delete dead code rather than commenting it out.

Avoid TODO comments without an issue/reference explaining why the work is deferred.

---

## Testing

Every behavioral change requires appropriate automated verification.

Expected layers:

- unit tests;
- component tests;
- API/integration tests;
- end-to-end tests;
- chemistry-content validation tests.

Frontend:

- Vitest for unit tests;
- appropriate React component testing;
- Playwright for critical end-to-end flows.

Backend:

- Pytest;
- isolated service/domain tests;
- API integration tests.

Chemistry domain logic requires unit coverage for both valid and invalid cases.

For every learning mode, maintain at least:

- one complete happy-path E2E test;
- one incorrect-answer/retry-path E2E test.

Do not weaken assertions merely to make a failing test pass.

Fix the cause.

---

## Verification before completion

Before declaring work complete, run all checks relevant to the changed scope.

At minimum verify:

- formatting;
- linting;
- type checking;
- unit tests;
- integration/component tests where relevant;
- production build;
- content validation when chemistry data changes.

Run the narrowest relevant tests during development and the repository quality gate before commit or PR completion.

If a required check cannot be executed, report exactly what was not run and why.

Never claim tests passed unless they were actually executed successfully.

---

## Security

Never commit:

- API keys;
- passwords;
- tokens;
- private keys;
- connection strings containing credentials;
- real `.env` files.

Only `.env.example` belongs in source control.

Example environment values must be obviously non-secret.

Validate environment configuration on startup and fail clearly when required variables are missing.

Treat all external input as untrusted.

Authentication and authorization decisions belong on the server.

Client-side hiding is not authorization.

Do not log credentials, authentication tokens, sensitive headers, or complete user secrets.

Dependency additions require a concrete use case.

Avoid adding a dependency for functionality that can be implemented safely and clearly with the existing stack.

---

## MCP and external integrations

MCP servers and external tools are trust boundaries.

Each tool must have:

- a stable name;
- a narrowly defined purpose;
- explicit input schema;
- explicit output schema;
- deterministic errors;
- authorization appropriate to its capability.

Do not expose generic unrestricted database, filesystem, shell, or HTTP-access tools through MCP.

Separate read-only tools from mutating tools.

Mutating operations must validate authorization server-side.

Tool implementations must call application/domain services rather than duplicate business logic.

Secrets used by MCP integrations must come from environment or secret-management infrastructure.

---

## Git workflow

`main` must remain releasable.

Create one logical change per branch and PR.

Branch names:

```text
feat/short-description
fix/short-description
refactor/short-description
docs/short-description
test/short-description
chore/short-description
```

Use Conventional Commits:

```text
feat(scope): description
fix(scope): description
refactor(scope): description
test(scope): description
docs(scope): description
chore(scope): description
```

Commits must be atomic.

Do not mix:

- feature development with unrelated refactoring;
- formatting sweeps with behavioral changes;
- dependency upgrades with unrelated implementation work.

Prefer small PRs that can be reviewed independently.

Do not rewrite, amend, squash, force-push, merge, or delete another contributor's work unless explicitly instructed.

---

## Agent workflow

Before implementation:

1. inspect relevant code and documentation;
2. identify applicable `AGENTS.md` files;
3. confirm existing patterns before introducing new ones;
4. check active ADRs and execution plans;
5. determine the smallest coherent implementation.

During implementation:

1. preserve module boundaries;
2. make incremental changes;
3. run focused tests;
4. avoid unrelated cleanup;
5. update documentation when behavior or architecture changes.

After implementation:

1. run required verification;
2. review the diff for accidental changes;
3. verify no secrets or generated junk are included;
4. summarize what changed;
5. report tests actually executed;
6. identify remaining limitations explicitly.

---

## Architecture changes

An ADR is required before introducing or replacing:

- frontend framework;
- backend runtime/framework;
- database technology;
- ORM/data-access strategy;
- state-management framework;
- authentication architecture;
- API style;
- persistence model;
- major external service;
- MCP trust model.

Do not make architecture changes implicitly as part of feature implementation.

---

## Definition of done

A change is complete only when:

- requested behavior works;
- relevant acceptance criteria are satisfied;
- automated tests pass;
- type checking and linting pass;
- responsive behavior is preserved;
- keyboard/accessibility behavior is preserved where applicable;
- chemistry data is validated and reviewed where applicable;
- documentation is updated;
- no secrets are introduced;
- the final diff contains only intentional changes.

---

## Repository mirror constraints

This directory is a local mirror of the ChatGPT project “Anorganická_chemie”.

- Treat every file under `sources/` as read-only reference material.
- Do not edit, rename, move, or delete synced project files.
- Synced files may be replaced the next time a task is created from this ChatGPT project.
