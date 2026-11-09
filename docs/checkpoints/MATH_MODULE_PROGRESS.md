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
- [ ] Web: /predmety/[subject] page with KaTeX preview, step viewer, video player
- [ ] Docs: dependencies, setup, guide for adding a subject

## Open questions for the owner

See the PR description and project thread.

## Resuming

Read this file and ADR 0015, then continue with the first unchecked milestone.
Run the API checks: `uv --directory apps/api run ruff check . && uv --directory apps/api run pytest -q`.
