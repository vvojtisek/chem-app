# Testing and quality gates

This file is the mechanical verification contract for humans and agents. Repository scripts must keep these command names stable. If a command does not yet exist during initial scaffolding, the scaffolding change must add it; do not substitute an undocumented command and claim the gate passed.

## Tooling and installation

- JavaScript/TypeScript package manager: pnpm through Corepack, using the committed `pnpm-lock.yaml`.
- Python environment and dependency manager: `uv`, using `apps/api/uv.lock`. Do not create or document a manual virtual environment.

Install locked dependencies:

```bash
pnpm install --frozen-lockfile
uv --directory apps/api sync --frozen --extra test
```

Lockfile changes require an intentional dependency change and review. CI must use frozen installs.

## Fast feedback during development

Run the narrowest relevant command after each behavior change.

Web unit/component test file:

```bash
pnpm --dir apps/web exec vitest run path/to/file.test.tsx
```

Chemistry package test file:

```bash
pnpm --dir packages/chemistry exec vitest run path/to/file.test.ts
```

API test file:

```bash
uv --directory apps/api run pytest -q tests/path/to/test_file.py
```

One Playwright project/spec:

```bash
pnpm --dir apps/web exec playwright test path/to/spec.ts
```

Do not use watch mode as completion evidence.

## Required full repository gate

Run from the repository root, in this order:

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

The root scripts have these responsibilities:

- `format:check` — Biome formatting check for supported JS/TS/JSON/CSS files.
- `lint` — Biome lint plus framework/package-specific lint rules.
- `typecheck` — strict TypeScript checking across every workspace package.
- `test` — all Vitest unit and component suites, including `packages/chemistry`.
- `content:validate` — schemas, stable-ID uniqueness, references, formula parsing, equation balance, review status and review fingerprints, aliases, and coverage reports, including chemistry-SME review coverage.
- `contracts:check` — regenerate OpenAPI/client artifacts in a temporary location and fail if committed generated artifacts differ.
- `build` — production builds for all deployable applications and packages.
- `test:e2e` — production-like Playwright tests, including offline startup and each learning mode's happy/error path. `offline-mode-matrix.spec.ts` visits only the home page online, then verifies the periodic table, nomenclature, equations, and flashcards hydrate and respond offline on desktop and mobile Chromium.

No gate may silently skip a workspace because it has no matching files. Intentional exclusions must be explicit in configuration.

## Release gate

```bash
pnpm content:release-check
```

This command fails until every shipped curriculum record has a current chemistry-SME review (see `docs/chemistry-content.md`). It is a release requirement, not part of the per-PR gate above, because it depends on human review rather than on the code in a change. Report its result in release notes, and in any PR that changes curriculum content.

## Scope matrix

| Changed area | Minimum additional evidence |
|---|---|
| Documentation only | Markdown/link checks when configured; manually verify commands and cross-references |
| `apps/web` | focused Vitest, web typecheck/lint, production web build; Playwright for behavior |
| `apps/api` | focused Pytest, Ruff, API suite; migration test when schema changes |
| `packages/chemistry` | full chemistry unit suite and `content:validate` |
| `content` | `content:validate`, affected chemistry fixtures, SME review status (`content:release-check`) |
| API schema/contracts | API tests, OpenAPI generation, `contracts:check`, web typecheck/build |
| Offline persistence/service worker | migration tests plus online-to-offline and update Playwright scenarios |
| Authentication/authorization | positive and negative API tests plus relevant browser flow |
| Database schema | Alembic upgrade from previous release, upgrade on empty DB, and documented recovery/rollback check |

Running a focused command never replaces the full gate before a PR is declared ready.

Authentication integration tests use an isolated PostgreSQL database with
Alembic migrations applied. They cover invalid and expired sessions, generic
login failures, login throttling, CSRF and Origin rejection, session rotation,
inactive accounts, ownership, and role denial. Browser tests verify the
unauthenticated redirect, login/logout, role-protected routes, previously
verified offline access, and attempt synchronization across two contexts.

## Test design rules

- Tests must be deterministic, isolated, and independent of execution order.
- Freeze or inject time for spaced-repetition and expiry behavior.
- Seed random question selection and report the seed on failure.
- Use positive and negative chemistry fixtures; do not weaken an assertion to accept an incorrect result.
- API tests use isolated databases and do not depend on developer data.
- Browser tests prefer roles/names and verify visible learner outcomes, not implementation details.
- Each core mode has at least one complete correct path and one incorrect-answer/retry path.
- Accessibility checks supplement, but do not replace, keyboard and screen-reader-oriented manual verification.

Nomenclature changes also run `pnpm --dir content generate:nomenclature` before `pnpm content:validate`. Unit/component fixtures verify draft exclusion, owner-approval attribution, both answer directions, retry scoring, and local recovery. Production Playwright tests exercise both directions with the owner-approved set, wrong-answer retry, 360 px layout, and an offline resume. SME review remains a separate content-quality gate; passing tests does not upgrade `owner-approved` to `reviewed`.

## Reporting

Completion and PR summaries list the exact commands executed and their results. If a required command cannot run, state the command, reason, and resulting risk. Never imply that an unrun check passed.
## Flashcards

The element-card browser flow must prove that a Czech card can be opened, flipped to its facts, presents an approved group mnemonic when one exists, and saves a local edit. The browser-store tests must cover both persistence and record removal; raw IndexedDB data is parsed before use.

## Automated accessibility

`apps/web/e2e/accessibility.spec.ts` uses axe-core Playwright with WCAG 2.0,
2.1, and 2.2 A/AA rule tags. It scans login and registration, the learner home,
periodic-table selection and active practice, nomenclature, equations,
flashcards, progress, and profile in desktop and mobile Chromium. Passing the
automated scan does not replace manual keyboard-only, focus visibility,
screen-reader, physical-device, or broader browser checks.
