# ADR 0010: Serve the privacy notice without a session

- Status: Accepted
- Date: 2026-10-02
- Decision owners: Product, engineering, and security
- Amends: ADR 0005

## Context

ADR 0005 requires a session for all normal web routes. ADR 0006 later added
public email registration, which collects personal data from people who do not
have an account yet. They must be able to read the privacy notice before they
submit their email address, but `/soukromi` redirected them to the login page.

## Decision

`/soukromi` is readable without a session. The web proxy lets it through
without a session cookie, and the client authentication gate renders it without
the application shell when the account check returns `401`, fails, or the
browser is offline without a verified account marker. A signed-in account still
sees it inside the normal shell. The registration page links to it.

The page is static, contains no account data, and makes no authenticated API
calls. Every API operation keeps its server-side session and role checks; this
decision changes only navigation.

## Consequences

- Registration can show the privacy notice before data collection.
- Other web routes still require a session as decided in ADR 0005.
- Links from the page to signed-in routes, such as the breadcrumb to
  `/napoveda`, lead anonymous visitors to the login page.
