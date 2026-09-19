# ADR 0003: Use local-first events, IndexedDB, and PostgreSQL synchronization

- Status: Accepted
- Date: 2026-09-19
- Decision owners: Product and engineering

## Context

Core learning must work without a network connection, while future accounts should support cross-device progress. Curriculum data is reviewed and versioned independently of user progress. The initial product sketch mentioned `localStorage`, but that synchronous key/value API is poorly suited to larger curriculum snapshots, event queues, transactional migrations, and indexed due-card queries.

## Decision

Use a local-first model:

- versioned IndexedDB stores hold reviewed curriculum snapshots, immutable attempt events, mastery inputs, spaced-repetition records, and pending synchronization;
- `localStorage` is limited to small non-sensitive preferences needed synchronously at startup;
- a service worker caches the application shell and versioned public curriculum/static assets, but not credentials or private API responses;
- each answer creates a stable client event ID and is applied locally immediately;
- authenticated online clients sync pending events to FastAPI using idempotent operations;
- PostgreSQL stores accepted server-side progress and account state;
- curriculum authoring files remain the source of truth and produce versioned runtime snapshots.

Persisted formats use explicit schema versions. Changes provide a tested migration or an explicit recoverable reset/export path.

## Consequences

### Positive

- Learners can complete exercises and review due cards offline.
- Immutable events make retries and deduplication clearer than overwriting aggregates.
- IndexedDB supports transactional, indexed, larger structured data.
- Curriculum and application updates can be versioned independently.

### Negative and mitigations

- Synchronization and migrations add complexity. Keep v1 conflict rules narrow, use idempotent event IDs, and test online-to-offline/update scenarios.
- Browser storage may be evicted. Communicate local-only status, handle quota errors, and prioritize progress export after the core MVP.
- Client mastery is not trustworthy for competitive or authorization decisions. The initial product has no competitive scoring; any future trusted scoring requires a threat model and ADR.
- Service workers can serve stale combinations. Version cache namespaces and content snapshots and test upgrades from supported releases.

## Revisit when

Revisit when trusted assessment, collaborative editing, very large curriculum assets, or mandatory cross-device guarantees become product requirements.
