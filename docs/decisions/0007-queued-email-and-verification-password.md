# ADR 0007: Queued account email and password selection after verification

- Status: Accepted
- Date: 2026-09-24
- Decision owners: Product, engineering, and security
- Amends: ADR 0006 account email delivery and registration sequence

## Context

Sending SMTP inside registration and recovery HTTP requests made account
existence observable through response time and held database connections during
network waits. Registration also accepted a password before proving ownership
of the address, allowing an attacker to reserve someone else's address with a
password they controlled.

## Decision

Registration accepts only an email address. The owner chooses a password when
consuming a single-use email verification link; verification and password
creation commit together. An unverified account cannot sign in and is removed
after seven days. Verification is refused after seven days even if cleanup has
not yet run. The address owner can start a new registration after that age.

Account links are written to a PostgreSQL mail outbox in the same transaction
as their token. A separate worker leases messages, sends them over SMTP, and
retries temporary delivery failures with bounded exponential backoff. Pending
outbox tokens are encrypted with a key derived from `SECRET_KEY`; token tables
continue to store hashes only. Revoking or deleting a token cascades to its
pending message. The worker drops expired, used, or otherwise invalid links.

Registration and recovery return generic `202` responses after durable queueing.
Missing SMTP configuration returns `503` for all addresses. An SMTP outage
after queueing is reported by the worker and retried; `202` means queued, not
delivered. Keep the worker running and monitor its failures and queue age.

## Consequences

- Run migration 0004 before starting the worker. Deploy the updated web
  verification form with the API contract change.
- A worker crash after SMTP accepts a message but before queue deletion may
  send the same link again. The link remains single-use.
- Rotating `SECRET_KEY` makes already queued links undecryptable; drain or
  discard the queue before rotation and ask affected users to request a new
  link.
- Outbox rows contain email addresses and encrypted action tokens. Database
  backups and access grants must protect them as account data.
