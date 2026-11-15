# ADR 0016: Record every graded chemistry exercise, with response time and hint use

- Status: Proposed
- Date: 2026-11-14
- Decision owners: Product owner and engineering
- Amends: ADR 0003 (attempt events), ADR 0009 (generations apply unchanged)
- Affects: `apps/web/lib/browser-progress-store.ts`, `apps/api/src/inorganic_api/api/attempt_schemas.py`,
  `packages/contracts`, `docs/api-contracts.md`, `docs/product-spec.md`

## Context

Pokrok can only show what attempts record. On `main` @ f95dc50 four modes record attempts:
`element-name`, `periodic-table`, `nomenclature` and `equation` (levels beginner, advanced, pro).
Not recorded:

- the preparation and production quiz (`/procvicovani/priprava-vyroba`, all three levels);
- the equation level „Lehká“ (`easy`), which is not in the `level` enum;
- the five-minute flashcard quiz (`/flashcards/prvky`);
- mathematics (online-only, ADR 0015; handled separately as an ADR 0015 addendum).

No attempt carries how long the learner took or whether a hint was used. A mastery view
(weak spots, speed, hint dependence) and a review schedule (ADR 0017) need both.

## Decision

1. New attempt variants, each with `eventSchemaVersion: 1` and a closed set of fields:
   - `production` with `level: easy | advanced | pro`, `questionId` = route ID (easy, advanced)
     or product ID (pro), `matchPolicy: product-set | approved-route`;
   - `equation` gains `level: easy` with `direction: products` and `matchPolicy: product-set`;
   - `element-card` (flashcard quiz) with `fields` = the sorted list of asked fields
     (`symbol`, `name`, `protonNumber`, `atomicWeight`, `valenceConfiguration`) and
     `matchPolicy: all-fields`.
2. Optional fields on every variant, valid on old and new events:
   - `responseMs`: integer 0..120000, milliseconds from showing the prompt to submitting;
     `null` when the tab was hidden during the question (Page Visibility API) or the value
     exceeded the cap;
   - `hintsUsed`: integer 0..10;
   - `skipped`: boolean, true when the learner used „Přeskočit“ before this answer.
3. The API accepts the new variants and fields in `attempt_events.payload` (JSONB). No new column,
   no new table, no change to the upload endpoint, its CSRF and Origin checks, the per-day quota,
   or the database role. `/me/stats` adds the new modes to `by_mode`.
4. The web client writes the new events through the existing IndexedDB attempt store and sync
   outbox, so they work offline exactly like today's attempts.

## Consequences

- Pokrok can show topic accuracy for all chemistry exercises, median response time and hint rate.
- `responseMs` is measured on the device and is self-reported, like `isCorrect` (ADR 0009). It is
  a learning signal, not proof.
- Older clients keep uploading events without the optional fields; readers treat a missing value
  as unknown, never as zero.
- Payload size grows by about 60 bytes per event.
- Any use of these fields beyond the learner's own Pokrok is governed by ADR 0018.

## Alternatives considered

- A separate „events“ table for timing and hints: duplicates the attempt identity and the sync
  path, and breaks the one-record-per-answer model of ADR 0003.
- Measuring time on the server: impossible offline, and upload time is not answer time.
