# ADR 0001: Use Next.js App Router for the web application

- Status: Accepted
- Date: 2026-09-19
- Decision owners: Product and engineering

## Context

The product specification allowed either Next.js or Vite with React. The repository architecture needs one frontend choice so routing, rendering, deployment, offline behavior, and agent instructions do not diverge. The application contains public/product pages that can benefit from server rendering, while the four learning modes are interaction-heavy and must remain usable offline.

## Decision

Use Next.js with the App Router, React, strict TypeScript, and Tailwind CSS in `apps/web`.

React Server Components are the default for route shells and online server-rendered work. Core exercises use narrowly scoped Client Components because they require input, local persistence, and offline execution. Offline-critical routes and curriculum assets must be buildable/cacheable without a live Next.js server response after installation.

Use TanStack Query only for asynchronous client-side server state. Use generated OpenAPI clients for API access. Do not introduce a parallel Vite application.

## Consequences

### Positive

- One documented routing and rendering model.
- Server rendering remains available for online pages without forcing it into offline exercises.
- App Router layouts, loading, and error boundaries provide consistent structure.
- React, TypeScript, and Tailwind match the intended UI stack.

### Negative and mitigations

- RSC/navigation requests do not automatically work offline. Offline-critical routes must use a cached shell and client-side domain/data access, with Playwright coverage.
- Server/Client boundaries add complexity. `apps/web/AGENTS.md` requires the smallest practical client boundary.
- Next.js upgrades can affect caching semantics. Pin versions and test install/update/offline flows before upgrades.

## Revisit when

Reconsider only if measured offline constraints cannot be met without fighting the framework, or deployment requirements make the server runtime unjustified. Replacing Next.js requires a superseding ADR and migration plan.
