# ADR 0015: Subject modules, server-side mathematics solver, Manim rendering and LLM explanations

- Status: Proposed
- Date: 2026-11-09
- Decision owners: Product owner and engineering
- Affects: `AGENTS.md` (product invariants: the product stops being chemistry-only),
  `apps/api/AGENTS.md` (domain boundary), `docs/architecture.md`,
  `docs/security.md`, `docker-compose.prod.yml`, `deploy/aws/`

## Context

The product owner asked for a mathematics module (university calculus) that
solves a typed problem step by step with SymPy, renders the steps as Manim
videos, adds LLM-written explanations, and is built on a subject abstraction
so that physics or biology can be added later by registering one class
(spec in the project thread of 2026-11-09, branch `feature/mathematics-module`).

What exists today (main @ b8d51f9), and what the spec assumed:

- There is no server-side chemistry module. All chemistry logic is pure
  TypeScript in `packages/chemistry` and `content/src`; the API stores
  accounts, sessions and attempt events and must not grow a chemistry parser
  (`apps/api/AGENTS.md`). There is nothing on the backend to "mirror" or
  refactor into a common base.
- There is no free-form problem input in the chemistry UI. Learners pick
  curated, SME-reviewed records. The closest pattern to "input, steps,
  playback" is the balancing lesson (`/uceni/prvky/vycislovani-rovnic`,
  `components/balancing-reactions-lesson.tsx`): a set picker, an equation
  display, a step navigator (previous/next) with a ledger per step. Steps are
  precomputed in `content/data/balancing-reactions.json`; there is no video,
  canvas or animation player.
- The app is offline-first (ADR 0003). Every learning route works offline
  from a bundled snapshot.
- Production is one `t4g.small` (2 vCPU burstable, 2 GB RAM, arm64) running
  Caddy, web (512 MB), api (512 MB) and PostgreSQL. All containers are
  read-only with small tmpfs mounts.

So this is a new product area with a new runtime shape (server computes,
server renders, third-party LLM), not an extension of an existing one.

## Decision

### 1. Subject modules in the API

`inorganic_api.subjects` defines `BaseSubjectModule`, an abstract class with:

- `describe()` — subject id, Czech label, and the problem types it accepts,
  each with a typed list of input fields. The web app renders the input form
  from this description, so a new subject needs no new route or layout.
- `parse(request)` — validate and parse input into a domain problem.
- `solve(problem)` — return an ordered list of steps (rule id, Czech title,
  LaTeX before/after, justification) and the final result.
- `visualize(problem, solution)` — return a declarative `SceneSpec` (data,
  never code) for the renderer.
- `explanation_context(problem, solution)` — the structured facts the LLM
  layer may use.
- `export_formats` — subset of `mp4`, `gif`, `svg`, `web`.

`SubjectRegistry` maps subject ids to instances. Subjects are registered in
one list (`subjects/catalog.py`). Routing (`/api/v1/subjects/{subject_id}/…`)
and the web page (`/predmety/[subject]`) are generic over the registry.

The abstraction has one implementation today. That conflicts with the
repository rule "introduce abstractions only when real consumers justify
them"; it is accepted because the product owner asked for it explicitly as
the extension point for physics and biology. Chemistry is not moved behind
it: its logic is client-side and offline, and wrapping it in a server module
would break ADR 0003.

### 2. Mathematics solver (SymPy, no `eval`)

- SymPy is added to the API. `sympy.parse_expr` and `sympify` evaluate
  Python code and are not used on user input. Input goes through our own
  tokenizer and precedence parser that builds SymPy objects directly from a
  whitelist: numbers, single-letter variables, `pi`, `e`, `oo`, `+ - * / ^`,
  parentheses, implicit multiplication (`2x`, `x(x+1)`), and named functions
  (`sin cos tan cot sec csc asin acos atan sinh cosh tanh exp ln log sqrt
  abs`). Limits: 200 characters, 120 tokens, nesting depth 20, integer
  literals up to 12 digits, numeric powers whose result would exceed 1000
  digits are rejected.
- Steps are produced by our own rule engines, not reconstructed from the
  answer: a recursive differentiator that records sum, constant multiple,
  power, product, quotient and chain rules; a limit engine that tries direct
  substitution, classifies `0/0` and `∞/∞`, applies L'Hôpital up to three
  times and otherwise falls back to SymPy's `limit` with that fact stated; an
  integration walker over `sympy.integrals.manualintegrate.integral_steps`
  (substitution, parts, partial fractions via `apart`, table rules), with
  definite integrals finished by the fundamental theorem; partial
  derivatives, gradient, directional derivative and iterated double and
  triple integrals over regions given by bounds. Each final result is checked
  against SymPy's own `diff`/`limit`/`integrate` (antiderivatives by
  differentiating them back). When the step engine and SymPy disagree, the
  answer shown is SymPy's, with a step and a note that say the step-by-step
  derivation was not used; a wrong step chain is never shown as the answer.
- SymPy can run for an unbounded time (`integrate`, `limit`). Every solve
  runs in a separate process (forked from a forkserver that has SymPy and
  the catalog preloaded) with a 10 s wall-clock timeout, a 768 MB
  address-space limit (applied in the child before solving), and a global
  cap of 2 concurrent solves, mirroring the Argon2 concurrency cap. A
  timeout returns `422 problem_too_complex`; a full queue returns
  `503 solver_busy` after 5 s. Measured RSS: the forkserver about 65 MB,
  each forked solve shares its pages, so the API's 512 MB `mem_limit` is
  unchanged.
- `POST /subjects/{id}/preview` parses fields for the live LaTeX preview. It
  only parses (no solving) and has its own, higher rate limit.

### 3. Rendering worker (Manim)

- Manim CE, LaTeX (`texlive-latex-base`, `texlive-latex-extra`, `dvisvgm`
  through Manim's default template) and ffmpeg are **not** added to the API
  image. A separate image (`apps/api/render.Dockerfile`, service
  `math-render`) contains them.
- The renderer never executes generated or LLM-written code. Scenes are a
  fixed, versioned module (`subjects/rendering/scenes.py`) that reads a
  validated `SceneSpec` JSON: sampled curve points, axis ranges, tangent and
  secant data, Riemann rectangles, a surface grid with a tangent plane, and
  step LaTeX strings. LaTeX in a spec comes only from SymPy's printer applied
  to parsed expressions; free text (titles, LLM narratives) is never passed
  to LaTeX. Manim's TeX template does not enable `-shell-escape`.
- Queue: a directory on a dedicated volume, not the database. The API writes
  `queue/<key>.json` atomically; the worker claims a job by renaming it to
  `work/`, renders with `manim -qm` (720p30) under a 180 s timeout and CPU
  and memory rlimits, and writes `out/<key>.mp4` (and `.gif` on request).
  `key` is the SHA-256 of the canonical spec plus the renderer version, so
  identical requests are rendered once and later requests are served from
  `out/`. The cache is capped (default 2 GB, oldest removed first).
- The worker container has `network_mode: none`, no database credentials,
  no secrets, read-only root, `cap_drop: ALL`, `cpus: 1.0`, `mem_limit: 1g`,
  `pids_limit: 64`, writable only the queue volume and a size-limited tmpfs
  for TeX and Manim temp files. The API mounts the same volume and only
  serves files whose name matches `^[0-9a-f]{64}\.(mp4|gif)$`.
- Rendering is off unless `MATH_RENDER_ENABLED=true`. The service is in a
  compose profile (`math`) so the current host is unaffected until the owner
  enables it.

### 4. LLM explanations

- Provider: Anthropic Claude through the Messages API with structured
  output (`output_config.format` JSON schema), through the official
  `anthropic` Python SDK behind a small adapter (`services/explanations.py`)
  with a 30 s timeout and one retry. Default model `claude-opus-5-5`
  (`MATH_LLM_MODEL`), low effort, server-side fallback enabled.
- Input: only the structured problem and SymPy steps (no user identity, no
  free text beyond the parsed expression). Output schema: per-step Czech
  narrative ("why this rule applies"), a summary, alternative methods and
  common mistakes. Scene parameters are not taken from the LLM in this
  increment: scenes are built only from the solver output. The response is validated with
  Pydantic; anything invalid is dropped and the deterministic steps are
  still shown. LLM output is displayed as text and never executed, never
  fed to LaTeX, never trusted for correctness.
- Off unless `MATH_LLM_API_KEY` is set. The key comes from
  `.env.production` like other secrets. Requires outbound HTTPS from the API
  container to `api.anthropic.com` (the API already has egress for GitHub).
- Results are cached in memory (LRU) by the canonical problem to bound cost.

### 5. Access, limits and offline

- All mathematics endpoints require a signed-in `user`, `tester` or `admin`;
  guests get 403. Mutating calls (solve, render, explain are `POST`) require
  CSRF and same-origin like every other mutation.
- Rate limits through the existing `consume_rate_limit`: solve 60 / 10 min per
  account, render 10 / hour per account and 100 / hour globally, explain
  20 / hour per account, field preview 600 / 10 min per account. A render or
  explanation request also counts as a solve, because the server recomputes
  the solution instead of trusting the client's copy.
- The mathematics page is online-only. It shows an explicit offline state
  and is not precached. No attempt events are written in this increment.

## Consequences

- The product is no longer chemistry-only. `AGENTS.md` product invariants
  and `docs/product-spec.md` need an owner decision on wording and on the UI
  language (this ADR assumes Czech UI and Czech step text).
- New dependencies: `sympy` (API), `manim` and system TeX/ffmpeg (render
  image only), `katex` (web, for the LaTeX preview).
- Security properties: read-only containers, least-privilege DB role,
  Argon2 cap, SameSite/Origin/CSRF, hashed sessions and encrypted outbox
  tokens are unchanged. New surface: CPU-heavy endpoints on a public host
  (mitigated by auth, limits, timeouts and the isolated worker), a new
  secret and outbound call to a third party, and a writable shared volume.
- Capacity: a `t4g.small` has 2 GB RAM in total. A 1 GB render worker next to
  PostgreSQL, API and web may cause memory pressure and CPU credit
  exhaustion. Enabling the `math` profile on production needs either a
  larger instance or accepting slow renders; this is unverified until
  measured on the host.
- Mathematics answers are computed, not SME-reviewed curriculum. The UI
  labels them as computed by SymPy, and LLM text as generated.

## Alternatives considered

- **Client-side math (e.g. a JS CAS)**: keeps offline, but no mature
  step-by-step JS engine covers this calculus scope, and the spec asks for
  SymPy and Manim.
- **Render inside the API container**: rejected; it would put TeX and
  ffmpeg in the API image, need a writable cache in a read-only container,
  and let a render starve login and sync.
- **Database job table**: gives the worker database credentials and needs a
  migration for a cache that is disposable. The file queue keeps the worker
  without network or credentials.
- **Prerender only (CI)**: safest, but cannot render problems a learner types.
