# ADR 0017: Review schedule derived from attempt history

- Status: Proposed
- Date: 2026-11-14
- Decision owners: Product owner and engineering
- Amends: ADR 0003
- Affects: `docs/product-spec.md` (flashcards: „deterministic spaced-repetition schedule“, not
  implemented on `main` @ f95dc50), `apps/web/lib/periodic-table-mastery.ts`, home and Pokrok

## Context

`docs/product-spec.md` requires a deterministic spaced-repetition schedule, but nothing on `main`
computes due dates. Today „K zopakování“ lists up to five periodic-table elements by recency-
weighted accuracy only. Learners who return daily need one answer to „what should I practise
now“, across exercises.

## Decision

1. An item is a `(mode, questionId)` pair. Its schedule is a pure function of that item's attempt
   history; nothing extra is stored or synced. Because attempts sync per account (ADR 0009), every
   device computes the same schedule once synced.
2. Algorithm: Leitner boxes with intervals 1, 2, 4, 8, 16 and 32 days. A first-round correct
   answer moves the item up one box (max 6); a wrong answer, a „Nevím“, or a revealed answer
   resets it to box 1. Retry-round answers (`round: retry`) and answers given less than 12 hours
   after the previous scheduled answer do not move the box. Due = last scheduled answer +
   interval of the box, compared in the learner's local day.
3. „Zvládnuto“ means box 4 or higher (last interval at least 8 days). Items with fewer than three
   answers stay „začínám“, matching `MIN_MASTERY_ATTEMPTS`.
4. The schedule runs in web code (`apps/web/lib/review-schedule.ts`), not in `packages/chemistry`,
   offline, from IndexedDB. Home shows „K opakování N“ with one button that starts a mixed round
   of due items (at most 20, oldest due first); Pokrok shows due counts per topic and a 7-day
   forecast.
5. Items whose content no longer exists in the current content version are ignored.

## Consequences

- Fulfils the spec requirement without a schema change; a progress reset (ADR 0009) resets the
  schedule because it removes the history.
- The algorithm can change later without migration, since it is derived. Changing it moves due
  dates for everyone at once; record such a change in an addendum.
- Mixed rounds need an exercise shell that can ask items of different modes in one queue; the
  first version mixes periodic-table, nomenclature and equation items.
- Cost: one pass over the account's attempts on page load. At 5,000 events a day cap this is
  a few milliseconds; not measured on low-end phones yet.

## Alternatives considered

- SM-2 or FSRS: better calibrated, but harder to explain to learners and needs per-item state
  that would have to be stored and synced. Can replace Leitner later behind the same interface.
- Server-side scheduling: breaks offline practice (ADR 0003).
