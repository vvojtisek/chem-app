# ADR 0006: Self-service accounts, guest access, and personal progression

- Status: Accepted
- Date: 2026-09-24
- Decision owners: Product, engineering, and security
- Supersedes: The no-registration and no-password-recovery provisions of ADR 0005

## Context

The product owner requested public email/password registration, self-service
password recovery, authenticated password changes, a read-only guest path,
role-based ownership, and personal progress statistics with rank progression.
The application already uses local Argon2id passwords, opaque PostgreSQL
sessions, CSRF protection, and immutable per-user attempt events.

## Decision

Keep local accounts and opaque server-side sessions. Registration verifies
email ownership before enabling the account. Password recovery uses random,
short-lived, single-use tokens; PostgreSQL stores token hashes only. Email is
sent through a configurable TLS SMTP transport. Missing mail configuration must
fail clearly when a mail-dependent operation is requested and in production
deployment validation.

Roles are `guest`, `user`, and `admin`; the existing `tester` compatibility
role remains for seeded/test accounts. Guests may read learning content, but
all mutations are rejected by the API and editing controls are unavailable in
the web UI. Registered users manage their own profile and device-local learning
data. Admins may manage account profiles and passwords; the last active admin
cannot be disabled or demoted. Every mutation continues to require same-origin
CSRF validation and server-side authorization.

Personal statistics are computed from server-accepted attempt events. Guest
and tester activity is excluded. Progression tiers use cumulative correct
attempts with fixed thresholds: Začátečník (0), Student (50), Pokročilý (250),
and Mistr anorganické chemie (1000). A bounded daily trend uses server-stored
attempt history. Attempt correctness is reported by the client and is therefore
self-reported, not verified; rank is a personal learning indicator, never a
competitive score, access-control input, or source of rewards.

## Consequences

- Open registration and email flows require abuse throttling, generic recovery
  responses, token expiry/consumption, email-delivery configuration, and
  security-focused positive and negative tests.
- Email addresses become unique account identifiers while existing usernames
  remain available for compatibility during transition.
- Guest clients cannot store attempts, checkpoints, preferences, or card edits.
- Profile progression can be recomputed from immutable server attempt history.
- Per-account attempt uploads are limited to 500 new events per UTC day; duplicate events are free to retry.
- Operators must configure SMTP credentials through runtime secret management
  before enabling email delivery in production.

## Revisit when

Revisit if the product adopts external identity providers, account linking,
classroom roles, or a competitive/public leaderboard.
