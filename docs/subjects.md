# Subject modules (mathematics and future subjects)

ADR 0015 adds server-side subject modules. Mathematics is the first one.
Chemistry stays as it is (TypeScript, offline) and is not a subject module.

## How a request flows

1. `GET /api/v1/subjects` lists the registered subjects, their problem types
   and input fields, and whether rendering and explanations are enabled.
2. The page `/predmety/<subject-id>` builds the form from that description.
   Nothing on the page is subject-specific, so a new subject needs no route,
   layout or component.
3. While the learner types, `POST /subjects/{id}/preview` parses each field
   and returns LaTeX or a field error (shown with KaTeX).
4. `POST /subjects/{id}/solve` runs the module in a sandboxed child process
   (10 s, address-space limit, at most 2 at once, LRU cache). The answer holds
   the problem, result, step tree, the SymPy check that verified it, and a
   scene spec for the SVG plot and the video.
5. Optional: `POST /subjects/{id}/renders` queues a Manim video (MP4 or GIF),
   and `POST /subjects/{id}/explanations` asks Claude for Czech narratives.
   Both are off unless configured; see [Enabling on a host](#enabling-on-a-host).

Code map (`apps/api/src/inorganic_api`):

| Path | Role |
| --- | --- |
| `subjects/base.py` | `BaseSubjectModule`, `InputField`, `ProblemType`, `Step`, `SubjectSolution` |
| `subjects/registry.py`, `subjects/catalog.py` | Registry and the list of installed subjects |
| `subjects/mathematics/` | Parser (no `eval`), solvers, scene builders, module |
| `subjects/rendering/spec.py` | `SceneSpec`, the only input the renderer accepts |
| `subjects/rendering/scenes.py`, `worker.py` | Fixed Manim scenes and the queue worker |
| `services/subjects.py`, `renders.py`, `explanations.py` | Sandbox, file queue, Claude client |
| `api/subjects.py` | HTTP endpoints, auth, CSRF and rate limits |

Web: `components/subject-workspace.tsx`, `scene-plot.tsx`, `math-tex.tsx`,
`app/predmety/[subject]/page.tsx`.

## Adding a subject

1. Create a package, for example `subjects/physics/`, with a class that
   extends `BaseSubjectModule[ProblemT, SolutionT]`:
   - `subject_id`: URL id, `^[a-z][a-z0-9-]{1,31}$` (Czech, e.g. `fyzika`).
   - `label`, `description`: Czech text shown on the page.
   - `problem_types()`: each `ProblemType` lists its `InputField`s (kind
     `expression`, `equation`, `constant`, `bound`, `vector`, `variable` or
     `choice`) and an `example` that fills the form.
   - `parse(problem_type, values)`: turn strings into a typed problem. Raise
     `SubjectError(code, message)` for bad input. Never use `eval`,
     `sympify` on raw text or `parse_expr`; reuse
     `subjects/mathematics/parser.py` for formulas.
   - `solve(problem)`: produce the result and a list of `Step`s. Check the
     result independently (as mathematics does with SymPy) and say which
     check was used in `verified_by`.
   - `to_solution(problem, solution)`: map to `SubjectSolution` (LaTeX strings).
   - Optional: `visualize` (return a `SceneSpec`), `explanation_context`
     (what Claude may see; no user data), `preview_field`.
2. Register it in `subjects/catalog.py`:
   `SubjectRegistry([MathematicsModule(), PhysicsModule()])`.
3. Add tests next to `tests/test_math_solvers.py` and an API test like
   `tests/test_subjects_api.py`.
4. Regenerate contracts only if you changed the API models:
   `pnpm contracts:generate`.
5. Link the page from the web navigation (`STUDY_MATERIALS` in
   `app/uceni/prvky/page.tsx` today).

Animations: the renderer only knows the scene kinds in `SceneSpec.kind`
(`derivative_2d`, `limit_2d`, `integral_2d`, `surface_3d`, `steps_only`). A
subject can reuse them (a curve with a tangent fits many physics graphs) or
use `steps_only`. A new kind needs a new fixed scene class in `scenes.py`,
a `SCENE_CLASSES` entry in `worker.py`, a bump of `RENDERER_VERSION` and a
render test. Scenes must never take code or free text from a request or
from the LLM.

## Local development

The solver needs only the normal API environment (`sympy` is a regular
dependency):

```sh
uv --directory apps/api sync --extra test
uv --directory apps/api run pytest -q tests/test_math_parser.py tests/test_math_solvers.py tests/test_subjects_api.py
```

Rendering needs system packages and the `render` extra. On Debian or Ubuntu:

```sh
sudo apt-get install -y --no-install-recommends ffmpeg dvisvgm \
  texlive-latex-base texlive-latex-extra texlive-fonts-recommended \
  libcairo2-dev libpango1.0-dev pkg-config fonts-dejavu-core
uv --directory apps/api sync --extra test --extra render
uv --directory apps/api run pytest -q -m render tests/test_math_rendering.py
```

Render tests are excluded from the default run (`-m 'not render'`) and run in
the `math-render` CI job. On macOS install `ffmpeg`, `cairo`, `pango` and
`pkg-config` with Homebrew and a TeX distribution as described in the Manim
Community installation guide; only Linux has been tested.

To run a worker against a local queue:

```sh
MATH_RENDER_DIR=/tmp/math-render uv --directory apps/api run \
  python -m inorganic_api.subjects.rendering.worker --once
```

## Enabling on a host

Everything is off by default; the solver page works without any of this.

- Animations: set `MATH_RENDER_ENABLED=true` in `.env.production`, build the
  worker image on the host and start the profile:

  ```sh
  docker compose --env-file .env.production -f docker-compose.prod.yml --profile math build math-render
  docker compose --env-file .env.production -f docker-compose.prod.yml --profile math up -d
  ```

  The image carries TeX Live and ffmpeg (expected well over 1 GB; not measured,
  because it was only built in CI) and is not published to
  GHCR, so Watchtower does not update it; rebuild it after a release that
  changes `subjects/rendering/`. The worker has no network, no secrets, a
  read-only root, 1 CPU, 1 GB RAM and 64 processes.
- Explanations: set `MATH_LLM_API_KEY` (Anthropic API key) and optionally
  `MATH_LLM_MODEL` (default `claude-opus-5-5`). The API then calls
  `api.anthropic.com`; only the parsed problem and the computed steps are
  sent, never user identity.

## Known limitations

- Expressions use `.` as the decimal separator; `,` separates arguments.
- Symbols are real. `sqrt(x)` at 0 from both sides returns 0 because SymPy
  extends `sqrt` to negative reals as a complex value.
- When the step engine cannot derive a limit or integral itself, the answer
  comes from SymPy's `limit` / `integrate` with a step and a note that say
  so, and the steps are shorter.
- The surface heatmap clamps extreme values, which can show flat areas.
- Rendering time on x86: about 10 s for 2D scenes and 45 s for 3D scenes.
  arm64 (t4g) has not been measured.
