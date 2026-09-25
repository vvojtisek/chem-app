# ADR 0009: Account progress generations and explicit reset

- Status: Accepted
- Date: 2026-09-25
- Decision owners: Product and engineering
- Amends: ADR 0003 and ADR 0006

## Context

Resetting only one browser would allow an offline second device to upload old attempts again. Deleting server events would also erase the daily upload quota accounting. Attempt events are immutable under ADR 0003.

## Decision

Each account and accepted attempt has a progress generation. Existing accounts and attempts start at the all-zero UUID. Each new answer is bound to the generation known by the authenticated client when it is created. A legacy event without the field belongs only to the initial generation. The server never relabels an event from an earlier generation. An upload containing an otherwise valid stale event fails with `409 progress_reset` before inserting any event. The client refreshes generation and discards the old local progress before retrying.

An authenticated `user` or `admin` may explicitly confirm an online reset. The API requires the existing session, Origin, and CSRF checks. Reset rotates the account generation in one transaction protected by the same per-account advisory lock as uploads and pulls. Old PostgreSQL events remain immutable and archived for quota accounting; active history, rank, trend, mode statistics, admin aggregates, and pull results include only the current generation. This is a logical reset, not physical erasure of server records. Any later personal-data erasure request needs a separate deletion workflow.

The web client reconciles the server generation before rendering authenticated practice. A mismatch atomically clears only that account's attempt, outbox, quarantine, and checkpoint stores plus progress cursor and retry metadata. Card overrides/custom cards and unrelated browser databases remain. Other devices make the same reconciliation before uploading. A reset crossing an upload or pull is detected by the server's generation check or the generation returned with the pull page; the client refreshes afterward. The offline account marker keeps the last verified generation to bind answers made while offline.

Periodic checkpoints move from the former device-wide store to the account's database. On initial-generation accounts, the new client makes one copy of any old device-wide checkpoints without removing the source or replacing an account checkpoint. This cannot prove which account originally owned a device-wide checkpoint; the source remains available for recovery. Rotated accounts never recopy it.

## Consequences

- Old clients may continue uploading initial-generation events until that account resets. After reset, their events are rejected and they must update.
- Reset does not restore daily quota. Archived attempts continue counting toward the 5,000-event UTC-day limit.
- A device offline during a reset may temporarily show old local mastery. Its next successful account check or sync clears it before upload. Offline attempts made in the old generation are removed at that point.
- Client-reported correctness remains self-reported. The generation is a synchronization boundary, not proof that an answer was generated honestly.
