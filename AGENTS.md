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

This is a monorepo with these primary boundaries:

- `apps/web` — Next.js, React, TypeScript, Tailwind CSS;
- `apps/api` — FastAPI, Python, Pydantic;
- PostgreSQL — persistent server-side storage;
- `packages/chemistry` — framework-independent chemistry/domain logic;
- `packages/contracts` — generated or shared API contracts;
- `packages/ui` — reusable presentation components;
- `content` — reviewed curriculum source data.

Prefer explicit, maintainable architecture over unnecessary abstraction.

Do not introduce competing frameworks, runtimes, persistence strategies, or
duplicate domain implementations without an accepted ADR.

An ADR is required before introducing or replacing:

- frontend or backend framework/runtime;
- database technology or ORM/data-access strategy;
- state-management framework;
- authentication architecture;
- API style;
- persistence model;
- major external service;
- MCP trust model.

Do not make architectural changes implicitly as part of feature implementation.

---

## Module boundaries

Keep dependencies aligned with the monorepo architecture:

- `apps/web` owns routing, presentation, browser state, offline behavior, and API-client orchestration. It must not depend on backend implementation internals.
- `apps/api` owns HTTP transport, authentication/authorization, persistence orchestration, server-side validation, and OpenAPI publication. It must not contain frontend concerns.
- `packages/chemistry` owns pure deterministic chemistry/domain behavior and must remain independent of UI, transport, persistence, and application frameworks.
- `packages/contracts` owns generated or shared API-contract artifacts.
- `packages/ui` owns reusable presentation primitives.
- `content` contains reviewed curriculum data, not application logic.

Do not duplicate domain logic across applications or layers.

Applications may depend on shared packages; shared domain packages must not depend on applications.

Keep domain models separate from persistence and transport models.

Introduce abstractions only when real consumers justify them.

---

## Naming

Use meaningful English names that describe intent rather than implementation mechanics.

Follow language and platform conventions:

- repository/general files: lowercase hyphenated names where appropriate;
- TypeScript variables/functions: `camelCase`;
- TypeScript types/classes/components: `PascalCase`;
- Python modules/functions/variables: `snake_case`;
- Python classes: `PascalCase`;
- database tables/columns: `snake_case`;
- environment variables: `UPPER_SNAKE_CASE`.

Language-specific conventions override generic filename conventions.

Avoid abbreviations unless they are established domain terms.

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

Tests must cover the changed behavior at the lowest useful level and include
integration or end-to-end coverage where the risk or user flow warrants it.

Bug fixes require a regression test when practical.

Do not weaken assertions, skip checks, or disable validation merely to make CI
pass. Fix the underlying cause.

Use the testing tools and commands defined by the applicable scoped
`AGENTS.md` and `docs/testing.md`.

Run focused tests during development and the relevant repository quality gate
before declaring the work complete.

Never claim a test or check passed unless it was actually executed
successfully.

---

## Verification and definition of done

Before declaring work complete:

- verify the requested behavior and applicable acceptance criteria;
- run formatting, linting, type checking, tests, build, and domain validation
  relevant to the changed scope;
- use the narrowest useful checks during development and the applicable
  repository quality gate before commit or PR completion;
- review the final diff for unintended changes;
- verify no secrets, generated junk, or unrelated modifications were introduced;
- preserve responsive, accessibility, compatibility, and domain invariants
  applicable to the changed area;
- update documentation when behavior, contracts, architecture, or operational
  requirements change.

If a required check cannot be executed, report exactly what was not run and why.

Never claim that a check passed unless it was actually executed successfully.

A change is complete only when the requested behavior works, relevant
verification passes, and the final diff contains only intentional changes.

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

Use branch prefixes:

- `feat/`
- `fix/`
- `refactor/`
- `docs/`
- `test/`
- `chore/`

Use Conventional Commits:

`<type>(<scope>): <description>`

Commits must be atomic.

Do not mix feature work, bug fixes, refactoring, formatting sweeps, dependency
upgrades, or other unrelated changes in one commit or PR.

Prefer small independently reviewable PRs.

Do not rewrite, amend, squash, force-push, merge, or delete another
contributor's work unless explicitly instructed.

---

## Agent workflow

Before implementation:

1. inspect relevant code, documentation, scoped `AGENTS.md`, ADRs, and active plans;
2. confirm existing patterns and architectural boundaries;
3. choose the smallest coherent implementation;
4. apply the adaptive model-routing policy before substantial work.

During implementation:

- make incremental, scoped changes;
- preserve module boundaries;
- run focused verification;
- avoid unrelated cleanup;
- update documentation when behavior, contracts, or architecture change.

Before completion:

- run the applicable verification defined above;
- review the diff for accidental changes;
- report what changed, checks actually executed, and any remaining limitations.
  
---

## Repository mirror constraints

This directory is a local mirror of the ChatGPT project “Anorganická_chemie”.

- Treat every file under `sources/` as read-only reference material.
- Do not edit, rename, move, or delete synced project files.
- Synced files may be replaced the next time a task is created from this ChatGPT project.

---

## Adaptive Codex model routing

For software-engineering work, use the `adaptive-model-router` skill to select
the least expensive appropriate agent before substantial implementation or
debugging work begins.

The parent coordinator normally runs on GPT-6 Luna High.

Use the routing policy defined by the skill instead of choosing stronger models
by default.

Delegate implementation or investigation to the configured specialized agent
when the skill indicates that a stronger model is appropriate.

Do not escalate merely because:
- a command fails once
- a test fails once
- the first implementation attempt is incorrect
- additional repository inspection is required

Preserve useful evidence when escalating so stronger agents do not repeat work
already performed.

The parent coordinator remains responsible for validating the final result
against the original request.
