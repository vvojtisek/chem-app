# ADR 0004: Use OIDC authorization code flow with server-side sessions

- Status: Accepted
- Date: 2026-09-19
- Decision owners: Product, engineering, and security

## Context

Core practice works anonymously and offline. Cross-device synchronization requires an account when online. The browser must not retain access or refresh tokens in `localStorage` or IndexedDB, and the API must own authorization decisions. No identity provider has been selected yet, so the architecture must use standards without coupling the domain to one vendor.

## Decision

Use OpenID Connect Authorization Code flow with PKCE through a configured external identity provider. FastAPI acts as the confidential relying party for the browser application:

- FastAPI starts login and validates state, nonce, issuer, audience, signature, and code exchange;
- provider tokens remain server-side and are never returned to browser JavaScript;
- the browser receives only a random opaque session identifier in a `Secure`, `HttpOnly`, appropriately `SameSite` cookie;
- session records are stored server-side as hashes, have absolute and idle expiry, and rotate after authentication and privilege changes;
- state-changing cookie-authenticated requests require CSRF protection;
- logout revokes the local session and uses provider logout only when supported and required;
- anonymous offline learning remains available, and local progress is linked/synchronized only after explicit sign-in.

Deploy the web and API as same-site origins. CORS remains an explicit allowlist. The identity-provider choice and operational credentials are deployment configuration, not domain logic.

## Consequences

### Positive

- No bearer or refresh token is exposed to browser storage.
- Standards-based provider substitution remains possible.
- Server-side revocation and authorization are explicit.
- Anonymous offline operation does not depend on identity-provider availability.

### Negative and mitigations

- Server-side sessions require persistence, cleanup, CSRF protection, and availability. Add lifecycle jobs and negative security tests with the authentication slice.
- Offline clients cannot authenticate or refresh a session. They continue locally and synchronize only after connectivity and a valid session return.
- Same-site deployment constrains hosting topology. Any cross-site deployment needs a security review of cookie and CSRF behavior.
- Account linking can conflict with existing server progress. Use immutable attempt IDs and an explicit merge preview/policy rather than overwriting local history.

## Implementation gate

This ADR authorizes the architecture, not a placeholder login. Do not expose authentication routes until provider configuration, encrypted server-side token handling where required, session schema/migration, CSRF defense, expiry/revocation, rate limits, and positive/negative integration tests are implemented together.

## Revisit when

Revisit if a native client, institution-managed SSO, passkeys without an OIDC provider, or cross-site deployment becomes a committed requirement.
