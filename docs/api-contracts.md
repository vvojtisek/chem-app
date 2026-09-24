# HTTP API contracts

## Authority and generation

FastAPI's generated OpenAPI document is the canonical HTTP contract. TypeScript types and client bindings in `packages/contracts` are generated from that document. Do not independently maintain equivalent frontend DTOs or hand-edit generated output.

Every operation must have a stable, unique `operation_id`, documented request/response schemas, and documented non-success responses.

## General conventions

- Base path: `/api/v1`.
- Media type: `application/json` unless an endpoint documents another representation.
- Field names: `camelCase` in JSON; adapters map explicitly to Python/SQL names.
- Timestamps: RFC 3339, UTC, with an explicit offset such as `2026-09-19T12:00:00Z`.
- IDs: opaque strings in HTTP. Clients must not infer type, order, or creation time from an ID.
- Optional fields and nullable fields are distinct in schemas.
- Unknown request fields are rejected for security-sensitive operations.

## Success responses

Return the resource or operation result directly unless a documented envelope adds necessary metadata. Creation normally returns `201`; a successful no-body deletion returns `204`; idempotent updates return the current resulting representation when useful.

List endpoints use cursor pagination:

```json
{
  "items": [],
  "nextCursor": null
}
```

The cursor is opaque. Endpoints define a bounded default and maximum page size and a stable ordering. Do not use unbounded collection responses.

## Error envelope

All JSON errors use:

```json
{
  "error": {
    "code": "invalid_answer",
    "message": "Human-readable description",
    "details": {},
    "requestId": "opaque-correlation-id"
  }
}
```

- `code` is stable and machine-readable.
- `message` is safe for display and must not contain secrets or internals.
- `details` is a documented object and defaults to `{}`.
- `requestId` is safe to share with support and contains no encoded user data.

Validation errors use the same envelope with code `validation_error`; `details.fields` may contain stable field paths and reason codes. Do not expose SQL text, exception classes, stack traces, tokens, or infrastructure identifiers.

## Status codes

- `400` — malformed operation not better represented below.
- `401` — missing or invalid authentication.
- `403` — authenticated but not authorized.
- `404` — resource is absent or intentionally concealed.
- `409` — state/version/idempotency conflict.
- `422` — structurally valid JSON that fails documented field validation.
- `429` — rate limit exceeded, with retry guidance where safe.
- `500` — unexpected server failure using a generic message.
- `503` — temporary dependency or availability failure.

Never use `200` for a failed operation.

## Authentication and authorization

ADRs 0005 and 0006 define local email/password accounts and opaque server
sessions. `POST /api/v1/auth/register` accepts an email and returns a generic
`202`; the account becomes active only when `POST /api/v1/auth/verify-email`
receives the single-use token and a new password. `POST
/api/v1/auth/verification/request` resends that link without revealing account
state. `POST /api/v1/auth/login` accepts email or a legacy username with a
password and sets the session and CSRF cookies; its JSON response contains the
current account only. `POST /api/v1/auth/guest` creates a read-only guest
session. `GET /api/v1/auth/me` returns the authenticated account or `401`.
`POST /api/v1/auth/logout` requires CSRF, revokes the session, clears cookies,
and returns `204`. Invalid credentials use one generic `401` response;
throttled login returns `429` with `Retry-After`.

`POST /api/v1/auth/password-reset/request` queues a short-lived recovery link
with a generic `202` response. Registration and verification requests also
queue links. The separate mail worker retries SMTP delivery; `202` confirms
queueing, while missing mail configuration returns `503` regardless of account
state. `POST /api/v1/auth/password-reset/confirm`
consumes that link and revokes the account's sessions. Authenticated users
change their password through `POST /api/v1/me/password` and edit their own
profile through `/api/v1/me/profile`. Admin account operations are under
`/api/v1/admin/users/{user_id}/profile` and `/password`. `GET
/api/v1/me/progression` returns the account's accepted attempt totals, rank, and
30-day daily trend. Guests cannot mutate progress or profile data; authorization
is enforced by the API even when a client omits a control.

The session cookie is HttpOnly; the separate CSRF cookie is readable by the
same-origin web client. Mutating requests send its value in `X-CSRF-Token` and
must include the configured public `Origin`. No session or CSRF token appears
in JSON or OpenAPI schemas. Protected operations declare authentication and
role requirements in OpenAPI and enforce them server-side.

## Offline mutation and idempotency

Retryable client mutations include a stable client-generated operation/event ID in a documented field or idempotency header. Repeating the same authenticated operation with the same ID and equivalent payload returns the same logical result without duplicating effects. Reusing an ID for a different payload returns `409`.

Attempt-event sync is append-only. Each event carries its content version and client occurrence time; the server records its receipt time separately and never treats the client clock as authoritative for authorization or ordering across devices.
Equation attempts use mode `equation`, carry the preparation/production content version, and distinguish beginner, advanced, and pro directions. Their correctness is self-reported like other attempt modes.

`POST /api/v1/me/attempt-events/batch` accepts up to 200 raw JSON values and validates each item independently, including rejecting non-object values as individual errors. `BatchResponse` lists accepted IDs, duplicate IDs, and rejected entries containing the batch index, optional event ID, stable rejection code, and safe message. A malformed or conflicting event must not discard other valid events in the same batch. Each account may add at most 5,000 new events per UTC day; duplicates do not consume quota. Clients keep `quota_exceeded` events in the outbox and retry them on the next UTC day. Clients move format and idempotency-conflict rejections, or locally unreadable events, to an account-local quarantine and continue synchronizing later events.

Progression ranks are personal display labels based on the `isCorrect` values submitted by that account's client. They are self-reported learning indicators, not verified assessments or competitive scores; clients can forge them and they must not grant privileges or rewards.

The attempt pull endpoint returns an opaque `nextCursor` after every nonempty
page. Clients persist that cursor and continue requesting pages until the API
returns an empty page with `nextCursor: null`; a short nonempty page is still a
valid checkpoint. This lets an offline client resume from its last durable
event while new events can arrive during synchronization.

## Concurrency

Mutable resources that can be edited concurrently expose a version or ETag. Updates include the expected version; stale updates return `409` or `412` with enough safe information to refresh. Do not silently overwrite concurrent changes.

## Versioning and compatibility

- Breaking HTTP changes require a new major path such as `/api/v2` or an accepted compatibility strategy.
- Additive optional fields are allowed within v1; clients must ignore unknown response fields.
- Removing fields, narrowing accepted values, changing meaning, or making optional data required is breaking.
- Keep the old contract during the documented migration window and test the currently deployed web client against the new API.

## Contract change workflow

1. Update FastAPI schemas and operation documentation.
2. Add/adjust API integration and OpenAPI snapshot/compatibility tests.
3. Generate the OpenAPI artifact and `packages/contracts` client.
4. Review generated changes; do not patch them manually.
5. Update web consumers and error handling.
6. Run the contract and production-build commands from `docs/testing.md`.
