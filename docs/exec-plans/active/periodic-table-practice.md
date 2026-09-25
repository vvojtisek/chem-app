# Periodic-table practice

## Goal

Deliver the first offline-capable periodic-table learning flow: a blind table
that asks for the position of a Czech element name, provides immediate feedback,
repeats an original error once, and records the full immutable attempt context.

## Scope

- A pure layout adapter that assigns all 118 reviewed elements to one visible
  main-grid or f-block position.
- A Czech position-to-answer route with deterministic ten-question sessions.
- A Czech position-to-name route with the same deterministic session and retry behavior.
- Pointer, touch, and keyboard-selectable blank cells with accessible position
  names and text feedback.
- Local attempt events using the periodic-table/name-to-position/exact-position
  context.
- Unit, component, and browser coverage for correct and retry paths.

## Non-goals

- Scope filters, random selection, mastery reporting, account synchronization,
  or new chemistry content.
- A new persisted schema: IndexedDB version 3 already stores mode, direction,
  match policy, and round. The new discriminator combination is backwards
  compatible with existing events.

## Constraints and decisions

- Follow `docs/product-spec.md` for the 18-group layout, f-block rows, retry
  behavior, offline use, and narrow-screen overflow.
- Follow the accepted Group-3 ADR: Sc-Y-Lu-Lr are main-grid group 3; La and Ac
  stay in the lower rows.
- Curriculum positions originate only from `@inorganic/content/runtime`.

## Milestones and evidence

1. Layout adapter proves 118 unique positions and the Group-3 decision in unit
   tests.
2. Both directions evaluate answers through the shared exercise-session state
   machine and write contextual local attempt events.
3. Component and Playwright tests cover both a correct answer and an
   incorrect-answer/retry path.
4. Run the full gate from `docs/testing.md`; record any environment limitation
   in the PR.

## Implementation update — 2026-09-25

The earlier PT-UX follow-up is implemented, including the previously missing
reload/offline recovery. Both practice directions save a versioned, validated
checkpoint in the existing IndexedDB session store without bumping the database
version. Restored state contains the chosen scope, mode, current question and
queue, solved/missed IDs, counters, and elapsed time; it does not store answer
text or emit a duplicate attempt. Invalid or outdated state can be removed
without clearing attempt history. Legacy import preserves active periodic-table
checkpoints, and a missed question can only receive one retry.

Validation on 2026-09-25: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm content:validate`, `pnpm contracts:check`, Ruff format and
lint, API tests with isolated PostgreSQL (38 passed), `pnpm build`, and the full
Playwright suite on desktop and mobile Chromium (70 passed). The app build used
an API proxy target and E2E used isolated ports because the default local ports
were occupied.

Chemistry-SME review is unchanged; the eight named group records still need
review before the curriculum release gate passes.
