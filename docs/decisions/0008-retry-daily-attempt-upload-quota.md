# ADR 0008: Retry daily attempt upload quota

- Status: Accepted
- Date: 2026-09-24
- Decision owners: Product and engineering
- Amends: ADR 0006 attempt upload quota

## Context

The 500-event daily upload quota could be reached by one nomenclature practice
run or a legacy history import. The browser treated `quota_exceeded` as a
permanent rejection and removed those attempts from its upload queue. Later
attempts on the same device could then be lost from server progress.

## Decision

Allow 5,000 new attempt events per account per UTC day. Duplicates continue to
be free to retry. When the server returns `quota_exceeded`, the browser keeps
those events in its account-local outbox and pauses uploads until the next UTC
day. It may still pull remote events while uploads are paused. Format and
idempotency-conflict rejections remain in the recoverable quarantine store.

Restore valid quota-rejected attempts quarantined by the previous client into
the outbox once, preserving their original IDs for idempotent retry.

## Consequences

- Large imports can take multiple days to synchronize, but local attempts stay
  available for practice and are not discarded.
- The server still bounds new event storage per account per day. Operators may
  revisit the threshold if usage data warrants a different limit.
