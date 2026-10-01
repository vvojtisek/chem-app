# Implementation plan: v1.1 – practice/learning refactor and element category colours

Status: active. This plan is committed before any code change, as requested. Each milestone
below is one atomic, independently reviewable commit carrying its own patch version.

## 1. Goal

1. `/procvicovani` offers only active-recall work (tests, quizzes, drills). Study and theory
   live under `/uceni`.
2. `/uceni/prvky` becomes a calm, structured entry point to study material with a clear path
   from overview to one element's detail.
3. The element category colours that exist only in the `/uceni/prvky/tabulka` explorer become
   one shared token set used on all non-quiz element surfaces in `/uceni` and `/procvicovani`.

## 2. Branch and versioning

- Branch: `claude/serene-dirac-h4tek1`. The task suggested a name such as `release/v1.1`, but
  this session may only push to its designated branch. It serves as the v1.1 feature branch;
  it can be renamed on GitHub before the merge without affecting the history.
- The app version shown in the shell comes from `apps/web/package.json` (`lib/app-version.ts`).
  Every code milestone bumps it to its patch number (`1.1.1`, `1.1.2`, …) in the same commit
  and names the version in the commit message, e.g.
  `feat(web): add preparation and production quiz (v1.1.2)`.
- This plan commit is `v1.1.0` and changes no version number.
- Nothing is merged into `main` until every milestone is complete and verified. Git tags are
  not pushed from this session; tag at merge time if wanted.

## 3. Findings from the discovery pass

### 3.1 The „Procházet výskyt a výrobu“ 404 does not reproduce from source

- The card on `/procvicovani` links to `/uceni/priprava-vyroba`
  (`apps/web/lib/practice-catalog.ts`). The route exists (`app/uceni/priprava-vyroba/page.tsx`,
  added in #29), is in the service-worker shell list, and has no Caddy path rule against it.
- A production build of the current `main` (`next build`, then `next start`) lists the route as
  static and answers `GET /uceni/priprava-vyroba` with HTTP 200.
- Likely causes outside the source: a deployment running an older image, or a stale service
  worker cache. I cannot inspect the deployed environment from here, so this remains
  unconfirmed.
- Resolution regardless of cause: the link is study material and does not belong on the
  practice page (requirement 1). It is replaced by a quiz (M2), and a unit test checks that
  every catalog link resolves to an existing `app/**/page.tsx` route. That catches broken
  catalog links before deployment.

### 3.2 There is no occurrence content, so „Test: Výskyt v přírodě“ cannot be built yet

- `content/data` has elements, groups, mnemonics, nomenclature and preparation/production.
  It has no occurrence, mineral or ore records.
- `AGENTS.md`: chemistry content must come from validated, reviewed data, and incorrect
  chemistry is worse than missing chemistry. An occurrence quiz therefore needs a new reviewed
  content collection (schema, validation, sources, SME review) first. That is out of scope for
  v1.1 and is listed in section 8.
- For the same reason the practice category title „Chemické rovnice, výskyt a výroba“ promises
  content that does not exist. It is renamed to „Chemické rovnice, příprava a výroba“.

### 3.3 CTA audit of `/procvicovani` (source: `lib/practice-catalog.ts`)

| Card | Link | Target | Active recall? | Action |
|---|---|---|---|---|
| Periodická tabulka | Procvičit pozice | `/procvicovani/periodicka-tabulka` | yes, blind table | keep |
| Periodická tabulka | Procvičit názvy a značky | `/procvicovani/prvky` | yes, typed recall | keep |
| Periodická tabulka | Pětiminutový kvíz prvků | `/flashcards/prvky` | yes, timed recall | keep |
| Rovnice | Procvičit rovnice | `/procvicovani/rovnice` | yes, graded balancing | keep |
| Rovnice | Procházet výskyt a výrobu | `/uceni/priprava-vyroba` | **no, read-only study** | replace with quiz (M2) |
| Názvosloví | Procvičit názvosloví | `/procvicovani/nazvoslovi` | yes, graded naming | keep |

The home dashboard shows the same catalog, so it changes too. Its separate „Učivo“ card keeps
linking the study page, which is the right place for it.

### 3.4 Category colours: current state

- The colours are hard-coded per `data-family` selector in
  `components/periodic-table-explorer.module.css` (alkali `#e77e70`, alkaline earth `#e2a52f`,
  transition `#a889c9`, other metal `#4f83bd`, metalloid `#62aaa1`, nonmetal `#69ad79`,
  halogen `#43b2d2`, noble gas `#e3bf4c`; the f-block has no colour and uses the neutral
  surface).
- The classification (`elementFamily()`) is a chemistry rule inside a UI component, which
  `apps/web/AGENTS.md` forbids. No other classifier exists, so nothing else is duplicated.
- The element data (`content/data/elements.json`) has no category field.

### 3.5 Conflict: global colouring versus active recall and the blind table

The task asks to apply category colours to *all* element cards, list items, badges and modals
in `/procvicovani`. Done literally, this undermines requirement 1 and the product
specification:

- `docs/product-spec.md` requires the periodic-table exercise to be fully blind: „every
  unanswered cell … shows the same „?“ with the same style, and no cell is highlighted,
  shaded…“. Category colour on the cells would show where the alkali metals, halogens and so
  on are, which gives the answer away.
- On a recall prompt (name → symbol, symbol → name, flashcard front), the category colour
  reveals the group, which is a hint the learner is meant to recall.
- On answered cells and feedback, colour already encodes correct/incorrect (green/red).
  Category colour there would compete with the correctness signal.

Resolution adopted by this plan; please confirm or override:

- **Rule: category colour never appears before the learner has answered.** It is used on study
  surfaces (`/uceni/*`), on the pre-quiz element selection step, and on post-answer surfaces
  (feedback after an answer, summaries, review lists).
- Correctness keeps its green/red tokens. Where both appear, category colour is a small
  swatch or badge, never the background that carries the verdict.
- Category is never conveyed by colour alone: every swatch has a visible or programmatic
  category label (spec: „never rely on color alone“).

## 4. Architecture decisions

No ADR is required: no framework, persistence, API style or state-management change.

1. **Element category classifier → `packages/chemistry`.** A pure
   `classifyElementCategory({ atomicNumber, group })` returns a typed union
   (`ElementCategory`). Its behaviour is moved unchanged from `elementFamily()`; it is not
   corrected. The conventions it encodes need chemistry-SME confirmation (section 6).
2. **Presentation tokens → `apps/web`.**
   - `app/globals.css`: `--category-<id>` colour tokens (one value each; they are mixed with
     the theme's surface tokens, so light and dark themes keep working).
   - `components/element-category.module.css`: the only place that maps
     `data-category="<id>"` to `--element-category-color`, plus shared tile, swatch, badge
     and panel classes.
   - `lib/element-categories.ts`: ordered category list with Czech labels. Labels are
     presentation; the category set is the domain union imported from
     `@inorganic/chemistry`, so the compiler rejects an unhandled category.
3. **Quiz composition → `apps/web/lib`.** The preparation/production quiz builds questions
   from reviewed runtime content. It adds no chemistry rule: the answer is the product record
   that owns the route, compared by stable ID. Randomness is injected so tests are seeded.
4. **No new attempt mode in v1.1.** Recording quiz attempts needs a new `mode` in the attempt
   contract (web Zod schema, API Pydantic schema, OpenAPI, server storage and progress
   aggregation). That is a cross-layer contract change. Like the existing five-minute element
   quiz (`/flashcards/prvky`), the new quiz shows session results but does not store attempts.
   Section 8 lists this as a follow-up.

## 5. Milestones

Each milestone: focused tests while developing, then the gate in section 7 before commit.

### M1 – v1.1.1 `refactor(web,chemistry): share element category tokens`

No visible change; extraction only.

- `packages/chemistry/src/element-category.ts` (+ export from `index.ts`):
  `ElementCategory`, `ELEMENT_CATEGORIES`, `classifyElementCategory`.
- `packages/chemistry/src/element-category.test.ts`: table-driven fixtures (H nonmetal; Li,
  Fr alkali; Be, Ra alkaline earth; Sc, Zn transition; La, Lu, Ac, Lr f-block; B, Po metalloid;
  Al, Bi other metal; F, At halogen; He, Og noble gas) and a count per category over Z = 1–118,
  which locks the moved behaviour.
- `apps/web/app/globals.css`: category tokens.
- `apps/web/components/element-category.module.css`, `apps/web/lib/element-categories.ts`.
- `periodic-table-explorer.tsx` / `.module.css`: use the shared classifier, labels and tokens;
  remove the local copies.
- Tests: the explorer legend renders every shared category label; each cell carries the
  shared category attribute.

Acceptance: the explorer looks and behaves the same; `elementFamily` and the hard-coded hex
values exist nowhere else.

### M2 – v1.1.2 `feat(web): replace study link on practice page with production quiz`

- New route `/procvicovani/priprava-vyroba`, „Kvíz: Příprava a výroba látek“.
  - Question: the reactant side of one reviewed route with its coefficients, the route kind
    (Příprava/Výroba) and its arrow conditions, then „→ ?“. „Kterou látku lze takto
    připravit/vyrobit?“ with four options (Czech name and typeset formula).
  - Eligible routes: those whose products contain the owning product's formula (106 routes:
    55 preparation, 51 manufacture, in the current content).
  - Distractors come from other product records, excluding any product that appears on
    either side of the route, and any product made by another route with the same reactant
    set. This rules out a distractor that is also chemically correct (e.g. NO and NO2 from
    Cu + HNO3).
  - Session: a filter step (Vše / Příprava / Výroba, question count 10 / 20 / all), shuffled
    order, a wrong answer returns at the end of the queue, the shared `PracticeDashboard`
    (progress, counts, stopwatch, Reset, Ukončit) and `PracticeSummary`. Feedback in a live
    region shows the verdict as text and icon plus the full equation. Keyboard: options are
    buttons in DOM order, and focus moves to the next question's first option.
  - Results are session-only (decision 4). The page states this plainly.
- `lib/preparation-production-quiz.ts` + tests: eligibility, the distractor exclusion rules
  (positive and negative fixtures), seeded determinism, the requeue-on-error queue.
- `lib/practice-catalog.ts`: replace „Procházet výskyt a výrobu“ with „Kvíz: Příprava a výroba
  látek“; rename the category title (3.2).
- Catalog audit test (`lib/practice-catalog.test.ts`): every link targets `/procvicovani/*`
  or `/flashcards/*`, and every href maps to an existing `app/**/page.tsx`.
- `public/sw.js`: add the route to the offline shell and bump the cache name, since the shell
  list changed.
- Update `app/procvicovani/page.test.tsx`, `app/page.test.tsx`, the e2e specs that assert the
  old link, and the offline mode matrix (add the quiz).
- Playwright: happy path, plus a wrong answer that requeues and is answered correctly later.

### M3 – v1.1.3 `feat(web): restructure element study page`

Current problems: three equal-weight header buttons, a search form with two selects, a flat
grid of 118 identical tiles, a long detail panel and a collapsed group overview all compete on
one screen.

New structure for `/uceni/prvky`:

1. **Header**: title and a one-sentence description.
2. **Study materials**: a compact row of three link cards with a one-line purpose each:
   Periodická tabulka (explorer), Karty prvků, Příprava a výroba látek. This replaces the three
   header buttons and is the one route to the other `/uceni` pages.
3. **Element index**:
   - search field (unchanged matching: `lib/element-search.ts`);
   - category filter tabs: „Vše“ plus one per category, each with a colour swatch, label and
     count. They are toggle buttons with `aria-pressed`, wrap on 360 px, and add no horizontal
     page scroll;
   - group and period selects move into a collapsed „Skupina a perioda“ disclosure, so they
     are still available but no longer the primary control;
   - results are **grouped by category** under headings (swatch, label, count) with compact
     colour-coded tiles (Z, symbol, name). An empty category section is hidden. Filtering by
     a group still shows its mnemonic (existing behaviour, spec).
4. **Element detail**: the panel keeps its content (facts, group mnemonic, preparation and
   production) and gains a category badge and category tint. On ≥ 1024 px it stays a sticky
   side panel. Below that, selecting a tile scrolls to the detail, which has „Zpět na přehled
   prvků“. That button returns focus to the selected tile.
   The selected element is mirrored in the URL hash (`#prvek-fe`), so a detail can be linked
   and the back button works. A hash is used instead of a query string because the service
   worker caches pages by pathname; the hash keeps deep links working offline.
5. **Group overview and mnemonics**: stays a collapsed section at the end, unchanged.

Tests: `filterElements` gains a category criterion (unit); the component tests cover the
category tabs, grouped headings, hash selection and focus return; the e2e accessibility scan
of `/uceni/prvky` passes on desktop and mobile; 360 px has no horizontal page overflow.

### M4 – v1.1.4 `feat(web): apply category colours to element surfaces`

Applies the rule in 3.5. Per surface:

| Surface | Route | Treatment |
|---|---|---|
| Explorer cells, legend, modal | `/uceni/prvky/tabulka` | already (M1) |
| Index tiles, tabs, detail | `/uceni/prvky` | already (M3) |
| Study card picker and card back | `/uceni/karty-prvku` | category badge on the flipped (back) side only; the picker shows only the symbol (spec), no colour |
| Element selection step | `/procvicovani/periodicka-tabulka`, `/flashcards/prvky` | none; the step has its own selected/unselected/partial states, and category colour would clash with them |
| Blind table during practice | `/procvicovani/periodicka-tabulka` | **none** (spec: fully blind) |
| Name/symbol prompt | `/procvicovani/prvky` | **none** before answering; category badge in the post-answer feedback line |
| Five-minute quiz card | `/flashcards/prvky` | **none** on the front; category badge on the revealed result |
| Weak elements („K zopakování“) list | `/`, `/pokrok` | category swatch and label per item |

Tests: each changed component asserts the category label is present after an answer and
absent before it (regression guard for the no-hint rule).

### M5 – v1.1.5 `docs: record v1.1 behaviour`

- `docs/product-spec.md`: the navigation, `/procvicovani` and `/uceni/prvky` sections, the new
  quiz, the colour rule from 3.5.
- `/napoveda` copy if it describes the changed pages.
- Move this plan's status to complete with evidence (commands and results per milestone).
- Final full gate (section 7) on the branch head, then the branch is ready to merge.

## 6. Chemistry review requirements

- M1 moves the classifier unchanged. The conventions it encodes are defensible but not
  universal, and need chemistry-SME confirmation for the Czech curriculum. Each of these is a
  real disagreement between sources:
  - **Be and Mg as „kovy alkalických zemin“.** IUPAC (Red Book 2005) counts all of group 2.
    Many Czech school texts traditionally limit the term to Ca, Sr, Ba and Ra.
  - **Group 12 (Zn, Cd, Hg) as transition metals.** IUPAC defines a transition element by an
    incomplete d subshell, which excludes group 12. Many textbooks include it as d-block
    metals.
  - **La/Ac versus Lu/Lr in group 3.** The classifier puts all of Z = 57–71 and 89–103 in the
    f-block. IUPAC has not adopted a final layout; its 2021 project report favours Lu/Lr
    under Y.
  - **Po as a metalloid; At as a halogen.** Both are borderline; Po is often classed as a
    metal.
  - **Nh–Og.** These are classified by group alone. Their chemistry is mostly predicted, not
    observed.
- No change to these conventions is made in v1.1. A changed convention is a content decision
  with review, not a refactor.
- The quiz uses only `owner-approved`/`reviewed` routes that already pass balance and
  lowest-ratio validation in runtime content, and adds no content.

## 7. Verification per milestone

Focused while developing (from `docs/testing.md`):

```bash
pnpm --dir packages/chemistry exec vitest run src/element-category.test.ts
pnpm --dir apps/web exec vitest run <changed test files>
pnpm --dir apps/web exec playwright test <changed spec>
```

Gate before each milestone commit, at minimum for the changed scope:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
pnpm build
```

Before marking the branch ready: the full repository gate from `docs/testing.md`, including
`pnpm contracts:check`, the Ruff and pytest API checks, and `pnpm test:e2e`. The e2e suite
needs PostgreSQL and the API. If they cannot run in this environment, the exact commands not
run and the reason will be reported, and the PR stays draft until CI runs them.

## 8. Out of scope and follow-ups

- Occurrence/minerals content collection and the „Test: Výskyt v přírodě“ quiz (needs
  authoring, sources and SME review first; 3.2).
- An attempt mode for the preparation/production quiz, so its results sync and count in
  progress (contract change; decision 4).
- Moving element categories into reviewed content data once the conventions in section 6
  are confirmed.
- Investigating the deployed environment's 404 (3.1) needs access to the deployment.

## 9. Rollback

Each milestone is one commit with no data migration. The service-worker cache bump in M2
replaces the shell cache on the next visit. Reverting a milestone commit restores the
previous behaviour; reverting M2 needs another cache-name bump so clients drop the cached
quiz route.
