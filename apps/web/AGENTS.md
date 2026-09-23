# Web application instructions

These instructions apply to `apps/web`. Read the repository-root `AGENTS.md`, `docs/architecture.md`, `docs/testing.md`, and relevant ADRs before changing this application.

## Responsibilities and boundaries

The web application owns routing, presentation, accessibility, browser persistence, offline behavior, and orchestration of generated API clients. It must not import from `apps/api`, duplicate API DTOs, embed curriculum records in components, or implement chemistry rules that belong in `packages/chemistry`.

## TypeScript

TypeScript strict mode is mandatory.

Do not use:

- `any` unless interacting with an unavoidable untyped boundary;
- unchecked type assertions to silence compiler errors;
- `@ts-ignore` without a documented reason;
- duplicated manually maintained API DTO types.

Prefer:

- `unknown` followed by validation;
- discriminated unions;
- readonly data where mutation is unnecessary;
- exhaustive `switch` handling;
- explicit domain types for identifiers and constrained values.

Use Zod at untrusted runtime boundaries where client-side validation is required.

Compile-time TypeScript types are not runtime validation.

## Next.js App Router

- Use the App Router. Keep route segments small and colocate route-only loading, error, and not-found UI.
- Default to React Server Components. Add `"use client"` only at the smallest boundary that needs state, events, effects, browser APIs, TanStack Query, or offline storage.
- Never import server-only modules, environment secrets, database code, or privileged SDKs into a Client Component.
- Core offline learning routes must not require a successful Server Component request after installation. Their interactive shell and reviewed curriculum snapshot must be cacheable.
- Use Server Actions only when they improve a server-owned workflow. Do not use them for core offline exercises or as an undocumented alternative API.
- Keep URL state shareable for stable filters where practical. Do not place answers, tokens, or sensitive state in URLs.
- Provide meaningful `loading.tsx`, `error.tsx`, and empty states. A network failure must not render a blank page.

## State and data fetching

- Use generated OpenAPI types and clients from `packages/contracts` for HTTP calls.
- Use TanStack Query for asynchronous server state in Client Components. Define query keys in a central key factory.
- Do not fetch server state in `useEffect` when a Server Component or TanStack Query is the correct owner.
- Keep transient interaction state local. Introduce global client state only for a demonstrated cross-route requirement.
- Treat cached curriculum, local progress, server state, and pending sync operations as distinct data classes.
- Mutations must define retry/idempotency behavior and update or invalidate all affected queries explicitly.
- Never silently discard an offline mutation. Queue it with a stable client operation ID or explain why the action requires a connection.

## Offline persistence

- Follow ADR 0003. Store structured curriculum, progress, and the sync queue in versioned IndexedDB stores.
- Reserve `localStorage` for small, non-sensitive preferences that require synchronous startup access.
- Every persisted schema change requires a tested migration or a user-visible recoverable reset path.
- Service-worker updates must be deliberate. Do not mix assets and authenticated API responses in one cache policy.
- Never cache credentials, session responses, or private user payloads in a shared runtime cache.

## Components and Tailwind CSS

- Reuse accessible primitives from `packages/ui`; keep chemistry-specific presentation adapters close to their feature.
- Use design tokens and established Tailwind utilities. Promote repeated arbitrary values to a token or shared component.
- Use a `cn`-style class composition helper rather than manual string concatenation for conditional classes.
- Keep variants explicit and typed. Do not encode behavior in visual class names.
- Avoid global CSS except for tokens, resets, typography, and third-party integration fixes.
- Preserve a usable 360 px layout. Periodic-table overflow must be discoverable and must not shrink targets below usable size.
- Keep the design clean, restrained, responsive, and content-first.
- Aim for Apple-like visual restraint without imitating Apple branding.
- Avoid unnecessary gradients, excessive animation, inconsistent spacing,
  oversized decorative UI, and controls without semantic purpose.

## Accessibility and learning feedback

- Core flows must support keyboard, pointer, and touch input.
- Use semantic controls, visible focus, programmatic labels, and logical focus order.
- Announce answer feedback and async state changes with an appropriate live region; do not move focus unexpectedly.
- Do not use color as the only indication of correctness, mastery, selection, or failure.
- Respect reduced-motion preferences and avoid animation that delays the next answer.
- Render chemical notation accessibly: preserve a plain-text or spoken equivalent for visual subscripts and formatted equations.

## Testing

- Use Vitest for units and components and Playwright for critical browser flows.
- Prefer user-visible roles and names in tests. Use test IDs only when no stable accessible selector exists.
- Test Server/Client boundaries, loading/error states, offline startup, persistence migrations, and keyboard behavior.
- Each learning mode needs a happy-path and incorrect-answer/retry-path Playwright test.
- Run the frontend commands specified in `docs/testing.md`; report anything not run.

## Completion checks

Before completion, confirm that no new Client Component boundary is broader than necessary, no DTO or chemistry rule was duplicated, the narrow layout and keyboard path work, relevant tests pass, and the production build succeeds.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
