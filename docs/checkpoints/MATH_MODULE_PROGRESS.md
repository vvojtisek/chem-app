# Mathematics module progress

Branch: `feature/mathematics-module` (never merged by agents; the owner merges).
Design: `docs/decisions/0015-subject-modules-and-mathematics.md` (Proposed).

## Audit findings (main @ b8d51f9)

- No server-side chemistry module exists. Chemistry logic is TypeScript only
  (`packages/chemistry`, `content/src`), offline, from curated data.
- No free-form input, video or animation player in the chemistry UI. Closest
  UX pattern: balancing lesson (`/uceni/prvky/vycislovani-rovnic`): set picker,
  equation display, step navigator with per-step ledger.
- Production: t4g.small (2 GB RAM), all containers read-only.

## Milestones

- [x] ADR 0015 (Proposed)
- [x] Safe expression parser (no eval) + tests (`tests/test_math_parser.py`)
- [x] BaseSubjectModule, registry, mathematics module (`apps/api/src/inorganic_api/subjects/`)
- [x] Step solvers: limits, derivatives (incl. implicit), integrals, multivariable (`tests/test_math_solvers.py`)
- [x] API endpoints, process sandbox, rate limits, auth (`tests/test_subjects_api.py`)
- [x] SceneSpec, fixed Manim scenes, file-queue render worker, render image (`tests/test_math_rendering.py`; `pytest -m render` renders 5 real videos, ~90 s on x86)
- [x] LLM explanation adapter (Claude, JSON schema), disabled without key
- [x] Web: /predmety/[subject] page with KaTeX preview, step viewer, SVG plot, video player (`components/subject-workspace.test.tsx`; checked in a local browser against a stubbed API)
- [x] Docs: `docs/subjects.md` (dependencies, setup, adding a subject), deployment, security, architecture, known limitations; ADR 0015 aligned with the code
- [ ] Owner review and decisions (see below); not merged to `main`

## Not verified

- Building `render.Dockerfile` (no Docker daemon in the agent environment; CI builds it).
- Rendering on arm64 / t4g.small, and anything on the production host.
- A real Claude call (no API key used); the adapter is tested with a fake completion.

## Owner decisions (2026-11-09)

1. LLM provider: not chosen (Claude or OpenAI). `MATH_LLM_PROVIDER=none` by default; only the `anthropic` adapter exists.
2. UI language: Czech.
3. Capacity: stay on t4g.small; upgrade only if monitoring shows high CPU.
4. Scope: supports learning at VŠCHT Praha, chemistry first, other subjects may follow; open source, non-commercial. AGENTS.md and product-spec updated.
5. Render image goes to GHCR only when the module is ready to merge to `main`.

## Resuming

Read this file and ADR 0015, then continue with the first unchecked milestone.
Run the API checks: `uv --directory apps/api run ruff check . && uv --directory apps/api run pytest -q`.
Run the web checks: `pnpm lint && pnpm format:check && pnpm --filter ./apps/web typecheck && pnpm --dir apps/web exec vitest run`.
