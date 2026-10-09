# ADR 0013: Administrator-created accounts replace self-registration

- Status: Proposed
- Date: 2026-10-09
- Decision owners: Product owner and engineering
- Supersedes: the public registration and email verification provisions of
  ADR 0006 and ADR 0007

## Context

The product owner no longer wants anyone to request an account. Public
registration sends mail to arbitrary addresses from an unauthenticated
endpoint and needs its own abuse limits, verification tokens, cleanup job and
pages. Administrators can already edit profiles, roles and passwords, but
cannot add an account except through the operator CLI.

## Decision

Remove public registration and email verification. Administrators create
accounts in the admin console with `POST /api/v1/admin/users`: email, optional
display name, and role (`user`, `admin`, or `tester`). The endpoint requires
the admin role, a session, the CSRF token, and the configured `Origin`; it is
limited to 30 creations per administrator per 15 minutes and logs the actor,
new account ID, and role without the email address.

The new account is active, its email is marked as confirmed by the
administrator, and its password is an Argon2 hash of a discarded random
secret. In the same transaction the API creates a single-use password-reset
token with `purpose = 'invite'` and a seven-day lifetime and queues it in the
encrypted mail outbox (ADR 0007). The invitation link opens the existing
password-reset form. The administrator never chooses or sees the password. If
the invitation expires, the person uses password recovery, or an administrator
sets a password.

Creating an account with an address that is already in use returns `409`.
This reveals account existence to administrators only, as the existing admin
profile editor already does; public password recovery still does not.

Migration 0007 adds `password_reset_tokens.purpose` with default `reset` and
deletes pending self-registrations, which can no longer be completed. The
`email_verification_tokens` table and `mail_outbox.verification_token_id`
stay unused for this release so the previous release keeps working during an
update or rollback; a later release may drop them.

## Consequences

- No unauthenticated endpoint creates accounts or sends mail except password
  recovery. The per-IP registration limit (issue #56) no longer applies.
- Account creation depends on working SMTP delivery, as recovery does. When
  SMTP is not configured the endpoint returns `503` and creates nothing.
- Someone with a pending registration must ask an administrator for an account.
- The operator CLI (`seed-accounts`, `set-password`) remains for bootstrap and
  emergencies.
