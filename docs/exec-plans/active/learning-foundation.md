# Learning-session foundation

## Goal

Create the deterministic client-side foundations that every learning mode needs before introducing reviewed curriculum content: a session state machine with one retry round and a versioned IndexedDB attempt-event store.

## Scope

- Generic, pure session transitions for a caller-provided ordered question list.
- Immediate recording of correct/incorrect results with a separate one-time retry round.
- Versioned browser storage for immutable attempt events.
- Unit tests for valid transitions, empty/duplicate question handling, retry behavior, ordering, and clean storage.

## Non-goals

- No chemistry curriculum records are published or marked reviewed.
- No answer-evaluation logic, server sync, authentication, mastery calculation, UI route, or database migration is included.
- No random question selection; callers supply deterministic order.

## Acceptance criteria

- Invalid initial lists return typed failures without starting a session.
- An incorrectly answered original question appears once in the retry round and cannot create another retry loop.
- Result counts distinguish original and retry answers.
- Attempt events persist in IndexedDB, are retrieved deterministically, and clear only the application-owned store.
- All affected unit tests, type checks, formatter/linter, content validation, build, and browser tests pass.

## Validation

- `pnpm --dir apps/web exec vitest run lib/exercise-session.test.ts`
- `pnpm --dir apps/web exec vitest run lib/browser-progress-store.test.ts`
- Full repository quality gate in `docs/testing.md`
