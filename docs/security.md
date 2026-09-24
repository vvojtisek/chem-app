# Security model

## Scope and principles

The product is offline-capable but may use accounts and synchronization. Security boundaries include the browser, service worker, HTTP API, PostgreSQL, content toolchain, CI/CD, external identity provider, and any MCP/external integration.

Apply least privilege, explicit validation, deny-by-default authorization, short-lived credentials, dependency minimization, and safe failure. Client-side hiding is never authorization.

## Secrets and configuration

- Never commit credentials, API keys, private keys, tokens, session cookies, or credential-bearing connection strings.
- Commit only `.env.example` with obviously fake values and documentation.
- Inject secrets at deployment/runtime and validate required configuration at startup.
- Browser-exposed `NEXT_PUBLIC_*` values are public by definition and must never contain secrets.
- Do not print secrets or complete sensitive headers in logs, test output, errors, screenshots, or telemetry.
- Rotate a secret immediately if it enters source control or an artifact; deleting the file is insufficient.

## Browser and PWA

- Do not store access/refresh tokens in `localStorage` or IndexedDB.
- Prefer secure, `HttpOnly` session cookies for browser authentication when compatible with the accepted auth ADR.
- Service-worker caches must exclude authentication endpoints, credentials, and private API responses unless a dedicated encrypted/offline design is accepted.
- Cache names and entries are versioned; activation removes only application-owned obsolete caches.
- Treat imported progress/content files as untrusted and validate schema, size, version, and references before applying them.
- Prevent formula/name rendering from becoming an HTML injection path. Render from parsed structures or escaped text; never pass curriculum text to unsafe HTML APIs.

## Web platform controls

- Define a restrictive Content Security Policy. Prefer nonces/hashes over `unsafe-inline`; do not allow `unsafe-eval` in production.
- Set frame restrictions (`frame-ancestors`), MIME sniffing protection, a conservative referrer policy, and an explicit permissions policy.
- CORS uses an environment-specific allowlist and never combines wildcard origins with credentials.
- State-changing cookie-authenticated requests require CSRF protection and appropriate `SameSite`, `Secure`, and `HttpOnly` flags.
- Validate redirects and callback URLs against an allowlist.

## API and authorization

- Validate request shape with Pydantic and enforce size/count limits before expensive work.
- Perform authorization in the application/service layer for every protected operation and resource.
- Use parameterized SQL through SQLAlchemy; never interpolate untrusted values into SQL.
- Rate-limit authentication and abuse-sensitive operations using privacy-conscious keys.
- Return the error envelope from `docs/api-contracts.md` without stack traces or infrastructure details.
- Use stable idempotency identifiers for offline retries and bind them to the authenticated principal and request payload.
- Treat client-generated timestamps, mastery values, roles, ownership, and content-review flags as untrusted.

## Authentication

ADRs 0005 and 0006 select local email/password accounts, verified public
registration, self-service recovery, and a restricted guest role. Use Argon2id
with current library defaults, reject passwords above 1024 bytes, and require
at least 12 characters. Login must verify a dummy hash for unknown users,
return the same error for unknown accounts and wrong passwords, and apply
database-backed per-account and per-IP throttles. Registration, verification,
and recovery must also be rate limited.

Email verification and password recovery tokens are cryptographically random,
single use, short lived, and stored only as SHA-256 hashes. Password-reset
responses must not reveal whether an account exists. Never log token values or
complete action links. Production email delivery requires configured TLS SMTP
settings; secrets belong in deployment environment or secret management.

Session identifiers are random opaque values; store only SHA-256 token hashes
in PostgreSQL. Enforce idle and absolute expiry and revoke sessions when an
account is disabled or its password changes. Browser cookies use the
`__Host-` prefix, `Secure`, `HttpOnly` for the session, `SameSite=Strict`, and
`Path=/`. Mutations require a matching CSRF cookie/header pair and a validated
same-origin `Origin`. Keep cookie and CSRF values out of logs and browser
storage. The offline account marker is a UX gate only and grants no server
authorization.

The API must enforce ownership in service operations. Guests cannot mutate
profiles, passwords, attempt history, or other account data. User writes are
owner scoped. Admin account management requires CSRF and explicit admin checks;
it cannot disable or demote the last active administrator. Tester activity
must not affect aggregate or personal progression statistics.

Authorization and session tests must include missing, expired, malformed, wrong-user, and insufficient-role cases. Administrative and content-review actions require separate explicit capabilities.

## Database and infrastructure

- PostgreSQL is reachable only by the API and migration jobs, not by browsers or generic tools.
- Use distinct least-privilege identities for application runtime and migrations where deployment permits.
- Encrypt transport to external services and databases; encrypt backups and restrict restoration access.
- Do not use production data in tests or local development.
- Apply migrations through a controlled release process and back up before destructive transformations.
- Logs use structured redaction and retention appropriate to the sensitivity of account/progress data.

## Supply chain and content

- Pin dependencies with committed lockfiles and review additions for maintenance, license, install scripts, and necessity.
- CI executes untrusted pull-request code without production secrets.
- Generated clients and curriculum artifacts are reproducible and checked for unexpected diffs.
- Curriculum sources are untrusted input to the build: validate and escape them even after SME review.
- Do not load remote scripts, fonts, or chemistry content at runtime without a documented availability, privacy, CSP, and integrity decision.

## MCP and external tools

- Treat each MCP server or external connector as a separate trust boundary.
- Expose narrow typed operations, not unrestricted shell, filesystem, database, or HTTP proxies.
- Separate read and mutation capabilities; enforce authorization server-side for mutations.
- Validate tool input/output, set timeouts, limit payload size, and translate failures deterministically.
- Tool services call application services rather than bypassing validation or duplicating domain logic.
- Keep connector credentials in the deployment secret store and redact them from tool traces.

## Security verification and response

Security-sensitive changes require negative tests and a short threat/risk note in the PR. Dependency and static-analysis scans supplement, but do not replace, review and tests.

If a vulnerability or secret exposure is suspected:

1. stop further exposure and preserve relevant evidence without copying secrets into issues/chat;
2. revoke/rotate affected credentials;
3. notify the repository security owner through the private reporting channel;
4. patch and test the narrowest safe fix;
5. review logs/artifacts and document follow-up controls without publishing exploitable details prematurely.

The repository must identify the private reporting contact before public release.
