# ADR 0005: Use local accounts and require sign-in

- Status: Accepted
- Date: 2026-09-23
- Decision owners: Product, engineering, and security
- Supersedes in part: ADR 0004

## Context

The first public installation is a closed learning environment with three
pre-provisioned accounts (`admin`, `user`, and `tester`) and no registration.
Attempt history must synchronize across devices. The product owner has chosen
to require authentication for all application routes, including when offline.
Existing local learning data remains recoverable through an explicit import
after sign-in.

## Decision

Use local username/password accounts. Store passwords with Argon2id and never
provide a public registration or password-reset flow. Provision and maintain
accounts through protected server-side CLI commands.

FastAPI owns authentication and authorization. A successful login creates an
opaque, random 32-byte session token; PostgreSQL stores only its SHA-256 hash.
Sessions have a seven-day idle lifetime and a 30-day absolute lifetime. The
browser receives a `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` cookie
using the `__Host-` prefix. State-changing requests require a separate
JavaScript-readable CSRF cookie, a matching `X-CSRF-Token` header, and the
configured same-origin `Origin`. Authentication failures are generic and
throttled in PostgreSQL by pseudonymous user and IP keys.

Roles are `admin`, `user`, and `tester`. Users and testers may read and write
only their own data. Admin-only diagnostics include account lists, aggregate
statistics, and read access to a user's attempt history. Tester attempts are
excluded from aggregate learning statistics.

All normal web routes require a session. The web proxy checks cookie presence
only as a navigation convenience; every API operation verifies the session and
role on the server. The client may remember the last verified account name,
role, and verification time in `localStorage` to let a previously authenticated
learner open the cached shell offline. This marker is not an authorization
credential and does not protect data on a device controlled by another person.

Attempt events remain local-first and immutable. After an explicit one-time
choice, existing v4 local attempt history may be imported into the signed-in
account. New attempts are queued atomically with their local write, uploaded in
batches, and pulled by cursor. Checkpoints, flashcard edits, and other learning
state remain device-local. Event IDs are unique per account; equivalent retries
are idempotent and reuse with a different payload returns `409`.

Deploy web and API under one HTTPS origin: `/api/*` routes to FastAPI and all
other paths route to Next.js. Caddy terminates TLS and PostgreSQL remains on a
private network. Registration and account creation through the UI are not
provided.

## Consequences

- Core practice requires a successful initial sign-in; offline entry is
  available only on a device with a prior verified account marker.
- A lost device may expose locally stored learning history to its next user.
  The marker is explicitly a UX gate, not a local data security boundary.
- Password hashing, throttle state, session cleanup, CSRF defenses, migration,
  backups, and negative authorization tests are required before release.
- Single-origin deployment avoids cross-site cookie and CORS complexity.
- Local accounts remove the OIDC provider dependency but require secure
  account provisioning and password rotation by the operator.

## Revisit when

Revisit if account self-service, institutional identity, public registration,
multiple installations, or a native client becomes a committed requirement.
