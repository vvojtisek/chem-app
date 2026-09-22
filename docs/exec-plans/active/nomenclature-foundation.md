# Nomenclature practice — developer implementation plan

Status: engineering handoff; implementation and chemistry review pending.
Prepared: 2026-09-22. Repository baseline inspected: `30c93a4`.

## 1. Outcome, scope, and deliverables

Deliver a Czech **Názvosloví** learning mode at the proposed route
`/procvicovani/nazvoslovi`. Learners select a scope, answer formula-to-name or
name-to-formula questions, receive deterministic feedback and an explanation,
retry initial mistakes once, and retain their progress offline and after reload.

“Testing názvosloví” means learner self-testing within the existing practice
product. This plan also specifies the automated tests developers must add. Timed
examinations, deferred grading, teacher administration, and trusted assessment
are separate product increments.

Use the supplied 126-entry JSON as authoring seed. Preserve every entry, but
publish only questions passing validation and chemistry-SME review. Parser
acceptance alone does not establish scientific correctness.

Deliver:

1. Reproducible seed import, review ledger, authoring schema, and reviewed snapshot.
2. Pure formula parsing and direction-aware grading in `packages/chemistry`.
3. Filters, answer entry/preview, feedback, one retry round, and results.
4. Versioned sessions and contextual attempt events in IndexedDB.
5. Production offline/update behavior, tests, and implementation documentation.

Non-goals: arbitrary formula-to-name generation, fuzzy/AI grading, automatic
synonyms, new frameworks, coordination/organic expansion to consume the seed,
accounts, synchronization endpoints, PostgreSQL seeding, or server grading.
Do not edit `sources/`. New dependencies need a concrete justification.

## 2. Repository baseline and policy decisions

Read the root and applicable nested `AGENTS.md` files before implementation.
Governing documents: [product](../../product-spec.md),
[chemistry](../../chemistry-content.md), [architecture](../../architecture.md),
[testing](../../testing.md), [security](../../security.md), and
[Sprint 3](../../../SPRINT_PLAN.md). Follow ADRs
[0001](../../decisions/0001-use-nextjs-app-router.md),
[0002](../../decisions/0002-use-fastapi-and-sqlalchemy.md), and
[0003](../../decisions/0003-offline-and-persistence-model.md).

These observations come from inspected code, not the older sprint audit:

| Existing area | Current behavior | Required work |
| --- | --- | --- |
| `packages/chemistry/src/normalize-answer.ts`, `evaluate-answer.ts` | Strict/tolerant Czech names and aliases | Reuse for names; never case-fold formulas |
| `packages/chemistry/src/normalize-formula.ts` | Lexical conversion only; no parser; ASCII `.` stays unchanged; all whitespace removed | Structural validation and safe spacing/dot rules |
| `apps/web/lib/exercise-session.ts` | Ordered questions, feedback, one retry round | Reuse transitions and integrate checkpoints |
| `apps/web/lib/browser-progress-store.ts` | Contextual attempts, but no nomenclature/session context or Zod boundary; unknown records filtered out | Versioned discriminated events and visible incompatibility recovery |
| `apps/web/lib/browser-learning-database.ts` | IndexedDB v3; attempts/cards; blocked handling exists; `VersionError` deletes the database | Safe downgrade prerequisite before adding stores/version |
| `content/src/schema.ts`, `validation.ts`, `validate.ts` | Elements/groups only | Nomenclature schemas, grammar/alias/review/coverage validation |
| `content/src/runtime.ts` | Authoring JSON projected without status filtering | Generate reviewed-only nomenclature artifact before client bundling; do not copy this unsafe pattern |
| `apps/web/public/sw.js` | Precache home/manifest; opportunistic caching; navigation fallback to home; broad cache deletion | Route/chunk/snapshot readiness, coherent updates, app-scoped cleanup |
| Home/API | Nomenclature card has no link; API currently health-only | Wire route; local learning must not depend on future API work |

### Explicit reconciliation of the old plan

The previous version of this plan required individual aliases for missing
diacritics and hydrate typography. That conflicts with the product/chemistry
contracts allowing tolerant names and documented formula typography. This plan
replaces that earlier requirement with:

- **Strict names:** canonical answer and reviewed aliases after NFC, Czech
  lowercase, outer trim, and repeated-whitespace collapse.
- **Tolerant names:** the same set plus the documented diacritics folding used by
  `evaluateAnswer`. No semantic guessing. SME approval of fixtures/collisions is
  required before release.
- **Formulas in both settings:** case-sensitive grammar and safe typography
  normalization; diacritics tolerance never affects formulas.
- **Semantic alternatives:** explicit, direction-specific reviewed aliases only.

This is a documented planning-policy resolution, not a code change or scientific
approval. No architecture replacement is proposed. Grammar/equivalence additions
still need documentation, positive/negative fixtures, and SME review.

## 3. Seed audit, preservation, and import

The full source is archived as [nomenclature-seed.json](nomenclature-seed.json).
All formula keys and text values are preserved; the archive adds a final newline.
It is planning input, **not runtime curriculum**. The
[review ledger](nomenclature-seed-review.md) accounts for every supplied record.

| Audited property | Count |
| --- | ---: |
| Records / unique formula keys | 126 / 126 |
| Duplicate canonical name strings | 0 |
| Hydrates using ASCII `.` | 20 |
| Square-bracket formulas | 2 |
| Explanations containing their full canonical name, case-insensitively | 125 |
| Records supplied with sources/review metadata | 0 |
| Records approved for release by this task | 0 |

Original attachment SHA-256:
`8ce591b35c1ac23c8009043235d30c9e2e895123498e7e35b2fada153815b73e`.
Archive SHA-256:
`ae7e9783d8a36a9bc7f883e446d5e16f3acfa99b9ef1af2fa955ab748ff74f99`.
Compare parsed values for fidelity; hashes differ because of the final newline.

### Import tasks

1. Read a bounded untrusted JSON map with exactly `nazev` and `napoveda` as
   nonempty strings. Detect duplicate object keys before ordinary parsing can
   overwrite them. Reject unknown fields/oversized input; never interpret HTML.
2. Create a permanent explicit source-key-to-ID map. Example:
   `nomenclature.copper-ii-sulfate-pentahydrate`. Do not derive identity by
   deleting formula punctuation, category, or array position.
3. Preserve source key/text and archive locator as authoring provenance. Normalize
   hydrate punctuation into a separate candidate canonical field. Unsupported
   formulas remain in validated staging with a reason.
4. Map `nazev` to candidate `nameCs`, and `napoveda` to candidate
   `explanationCs`. Do not extract aliases or pre-answer hints from prose.
5. Create **draft** records with empty aliases, review issues, and a responsible
   editor. Do not invent reviewer names, approval dates, or scientific sources.
   User-provided seed is provenance, not sufficient scientific evidence.
6. Editor assigns category/tags/difficulty/context/directions; SME approves
   scientific fields, explanations, and accepted answers together.
7. Report all 126 source keys as imported drafts or retained staging entries.
   Re-import must be deterministic/idempotent and preserve editor corrections;
   source changes produce a conflict/diff, not silent overwrite.
8. Generate production snapshots from eligible reviewed records only. Exclude
   drafts, staging, in-review/deprecated records, and authoring metadata from the
   client artifact. Invalid reviewed eligible content fails the build.

The implementing PR adds `content/data/nomenclature.json` and, if necessary,
`content/staging/` for unsupported entries. Staging validation checks shape and
disposition without pretending unsupported formulas satisfy runtime grammar.

### Required review decisions

- **Answer disclosure:** 125 imported hints contain the answer. Display them as
  **Vysvětlení** after grading or explicit reveal. Any later pre-answer hint is
  separately authored and reviewed per direction.
- **Complexes:** defer `H[AuCl4]` and `K2[HgI4]`; never remove square brackets to
  make them parse. Their later grammar/naming extension requires its own fixtures.
- **Context:** HCl/HBr/HF prompts must distinguish the compound from an aqueous
  acid. Do not automatically accept an acid-name alias for a bare compound prompt.
  This distinction is described in the
  [VŠCHT nomenclature material](https://e-learning.vscht.cz/mod/page/view.php?id=13158&lang=en).
- **Explanations/coverage:** adjudicate the oxalic-acid text, thiosulfate convention,
  mixed oxidation states, molecular/empirical forms, special compounds, and hydrate
  forms listed in the ledger. Do not turn prose into a general naming algorithm.
- **Target:** 126 compounds are not 126 reviewed questions. Report compounds,
  direction-specific questions, and category/difficulty coverage separately;
  never claim the 100-question baseline merely from import counts.

## 4. Proposed data contracts

Fields, filenames, and APIs proposed below do not exist yet. Authoring/runtime
Zod schemas belong in `content`; pure domain types/evaluation belong in
`packages/chemistry`. Pass reviewed element symbols into the parser so chemistry
does not import `content` and create a dependency cycle.

Use one compound record with explicit direction configuration and generate
question references. Do not duplicate chemistry text for each direction.

| Field | Contract |
| --- | --- |
| `id` | Permanent unique namespaced ID |
| `formula` | Canonical ASCII digits and hydrate `·`; full parse for runtime |
| `nameCs` | Canonical Czech answer |
| `baseCategory` | `oxide`, `hydroxide`, `binary-acid`, `binary-salt`, `oxoacid`, `oxoacid-salt`, `hydrogensalt`, or `extension` |
| `tags` | Reviewed orthogonal labels such as `hydrate`, `double-salt`, `peroxide`, `mixed-oxidation`, `trivial-name` |
| `difficulty` | `basic`, `intermediate`, `advanced` |
| `contextCs` | Optional reviewed prompt qualification, not extracted from prose |
| `directions` | Explicit enabled directions; direction-specific aliases and any prompt qualification |
| `explanationCs` | Reviewed worked explanation, available after submission/reveal |
| `status`, `author`, `sources`, `reviewedBy`, `reviewedAt` | Existing authoring convention; approval metadata required for reviewed content |
| `provenance` | Original seed key/archive locator; authoring-only |
| `reviewIssues` | Stable issue IDs/disposition; unresolved scientific issue blocks eligibility |

Allow unresolved classification/difficulty/direction decisions explicitly in
drafts; reject them in the release schema. Every alias has value, reason, and
source references. Name aliases apply to formula-to-name, formula aliases to
name-to-formula. Text mentioned only in an explanation is not accepted.

Example generated identity:

```text
compoundId: nomenclature.copper-ii-sulfate-pentahydrate
questionId: nomenclature.copper-ii-sulfate-pentahydrate.formula-to-name
direction: formula-to-name
```

The reverse direction has a separate question ID. Persist both IDs/content version;
display corrections or recategorization never rename an existing ID.

Snapshot envelope: `schemaVersion`, `contentVersion`, sorted compounds and question
descriptors referencing `compoundId`. Derive version from canonical serialized
runtime payload, including aliases/context/explanations, and record generator
version. Identical inputs produce identical output. Reviewer-only edits need not
invalidate runtime. Do not hardcode versions in React or spread authoring objects
into the bundle. Include only safe public source credits where needed.

### Filter and difficulty semantics

Expose the product categories, separately selectable binary acids/salts, and
**Hydráty** as a tag selection. Category selections form a union, deduplicated by
compound ID; intersect that union with selected difficulty and direction.
For example, a reviewed sulfate hydrate can match both oxoacid-salts and hydrates
but appears once. Explain this in help/counts. `extension` records remain disabled
pending explicit scope decisions and reviewed fixtures.

Proposed rubric for SME approval: basic single-step binary names; intermediate
polyatomic groups/hydroxides/oxoacids/salts; advanced hydrogen salts, hydrates,
double salts, and special conventions. Difficulty is authored, not guessed from
formula length. Do not force special compounds into misleading core categories.

## 5. Parsing and grading

### Initial grammar

Implement full-consumption parsing separately from lexical normalization,
answer equivalence, atom counting, and display rendering:

- Reviewed element symbols with exact capitalization; adjacent atom terms.
- Positive integer subscripts, implicit one when omitted.
- Non-nested parentheses containing atom sequences, with optional positive
  multiplier. Reject empty/nested/mismatched groups in this increment.
- One terminal hydrate segment `·nH2O` or `·H2O`. Convert `.`/`⋅` only in this
  unambiguous position. Reject decimal-like `Fe1.5O`, fractional water counts,
  trailing separators, and arbitrary adducts.
- No charges, square brackets, isotopes, phases, equation coefficients, bond
  symbols, or trailing prose. Return typed failure rather than partial parsing.

Document limits and reviewed fixtures in `docs/chemistry-content.md`. Proposed
safety limits: 256 characters, 128 terms, multipliers 1–999, checked safe-integer
arithmetic. Reject zero, leading-zero counts, decimals, and overflow. These are
explicit parser limits, not chemical claims.

Normalize NFC and subscript digits. Permit whitespace around complete tokens,
groups, and separators, but reject whitespace merging an element symbol or number
(`C o`, `H2 0`). Existing unconditional whitespace deletion is not an acceptance
rule. Never lowercase formulas, discard unknown characters, or repair brackets.

Return an AST, normalized canonical notation, atom counts, and typed errors with
positions. Preview diagnostics must not reveal expected answers. Atom counts are
useful for validation/future equations but are not sufficient compound identity.

### Evaluator

Proposed pure API: `evaluateNomenclatureAnswer(question, input, policy, symbols)`.
Keep existing generic-name evaluation backward compatible. Return correctness,
match kind (`canonical`, `alias`, `missing-diacritics`, `none`), and a typed reason
(`wrong-answer`, `invalid-formula`, `unsupported-notation`) with parser details
where relevant. Empty input is a form-validation state, not an attempt.

- Formula-to-name uses documented name normalization and approved aliases only.
- Name-to-formula fully parses input and expected/alias formulas, then compares
  the documented normalized representation. Do not sort atom tokens, flatten
  grouping, or reduce subscripts to empirical ratios automatically.
- Alternate order/grouping or molecular/empirical representations require explicit
  reviewed aliases. Never make `H2O2` equivalent to `HO`.
- Detect normalized name/alias collisions across different meanings, including
  tolerant folding. Reject ambiguous reverse prompts during content validation;
  add reviewed context/accepted forms or disable the reverse direction.
- Do not infer charges, automatic suffix substitutions, or aliases from prose.

## 6. Learner flow and scoring

### Setup

- Home links to **Procvičit názvosloví**, with Czech title/help on the route.
- Direction: **Vzorec → název** or **Název → vzorec**; one per session.
- Multi-select categories/difficulties and explicit name policy. Defaults: strict
  names, all available core categories/difficulties, ten questions.
- Length: 10, 20, or all eligible. Display the actual smaller count if necessary;
  never pad with repeats or silently broaden scope.
- Empty selections, empty reviewed curriculum, and no filter matches have distinct
  messages and disabled Start.
- Select without replacement using injected seeded randomness and stable ordering.
  Persist seed and selected IDs/order; reload never reshuffles.
- Editing setup does not alter an active session. Replacing a series requires an
  explicit learner action and keeps historical attempts.

### Answer entry

Show question number/round/direction/category/difficulty and reviewed context.
Use editable plain text with a derived formula preview for formula answers;
disable autocapitalization/autocorrection. Never replace editable input with
typographic subscripts or guess repairs for invalid input.

Enter submits but does not also advance feedback. Lock repeat submission
immediately; ignore composition Enter. Empty input creates no event. A nonempty
wrong name or invalid formula is one incorrect attempt with relevant feedback,
not an unlimited unrecorded trial.

### Feedback and results

- Submission shows **Správně**/**Nesprávně**, submitted answer, canonical name and
  formula, and reviewed **Vysvětlení**.
- Tolerated diacritics and aliases are correct, with canonical spelling displayed
  and the match kind recorded. A brief diacritics reminder must not mark it wrong.
- **Zobrazit řešení** is an alternative to answering: outcome `revealed`,
  `isCorrect: false`, then feedback. It is not unaided success.
- Initial incorrect/revealed items enter the existing single retry round. Retry
  failures cannot create another round. Clear input, explanation, and reveal state
  when advancing; hide the solution again on retry.
- **Pokračovat** advances deliberately. Announce feedback with a live region and
  focus the next input predictably after advancement, never while typing.
- Results separate initial/retry counts, revealed subsets, direction/policy,
  category, and difficulty. Main accuracy is `initialCorrect / initialQuestionCount`;
  retries never inflate it. Reveals count among incorrect and are also labeled.
- **Nová série** returns to setup without deleting history. This increment captures
  mastery inputs but does not invent a mastery percentage.

Support keyboard, pointer, touch, visible focus, and a usable 360 px layout.
Formulas need accessible plain-text/spoken equivalents. Do not reveal answers in
labels, hidden DOM, or previews before submission. Answers can exist locally for
offline grading; this is self-testing, not a tamper-resistant examination.

## 7. Persistence, compatibility, and offline requirements

### Events and checkpoints

Extend local events with a Zod discriminated union. Preserve legacy contexts with
their original meaning. Add `mode: nomenclature`, both directions, and explicit
policies such as `name-strict`, `name-diacritics-tolerant`, `formula-canonical`.
Store setup separately; formula attempts never claim a diacritics policy.

New events include event/schema version, session ID, sequence, question/compound
IDs, content version, round, outcome, match kind, and occurrence timestamp. Do not
fabricate new fields on old events that did not record them. Do not silently drop
unknown records via a type filter.

Add versioned session and curriculum-snapshot stores in the existing IndexedDB.
Checkpoint settings, selected order, current position, retry queue, summary,
active/feedback/complete state, seed, content version, current input, and feedback.
Order input writes so stale asynchronous saves cannot overwrite newer input.
Raw answers need only remain in the resumable session, not permanent telemetry.

Persist an immutable attempt and post-submission checkpoint in one transaction.
Allocate event ID/sequence once and reuse them on retries. Equivalent replay is
idempotent; conflicting payload returns a recoverable conflict. Double click,
repeated Enter, reload after commit, or retry must not duplicate events/retry items.
Use expected checkpoint revisions to prevent two tabs advancing the same session;
a stale tab offers resume/refresh.

Quota/denied-storage failure leaves practice usable in memory with a persistent
**Výsledek se nepodařilo uložit** notice and explicit save retry. Never claim unsaved
work survives reload. Notices must remain visible on feedback/results too. A corrupt
checkpoint offers recovery of that session without clearing attempts or cards.
Missing snapshots never cause silent regrading against newer content.

### Migration prerequisite: unsafe downgrade behavior

Current v3 clients delete the database on `VersionError`. Fixing only the new
client before a v4 bump is insufficient: an old cached client can still delete
the upgraded database. Stage the release:

1. First ship a compatibility update retaining **v3**: remove automatic deletion,
   surface downgrade recovery, close connections on `versionchange`, and refresh
   supported service-worker caches safely.
2. Gate schema upgrade on that compatibility update. The supported upgrade path
   must prevent unsafe old application code reopening the newer database; require
   other tabs closed/reloaded and retain roll-forward deployment capability.
3. Prove the gate with old-tab/old-cache browser tests. If it cannot be enforced for
   deployed clients, block the bump and document a reviewed compatibility design
   (ADR if the persistence model changes). New-client-only tests are insufficient.
4. Migrate v3 to the next available version transactionally, preserving attempts
   and element-card overrides. Test fresh databases and supported prior versions.

Coordinate with periodic-table session-persistence work in `SPRINT_PLAN.md`.
Reuse new shared stores if that work lands first; allocate the next schema version
at implementation time. Never resolve upgrade failure by silently deleting data.

Pin a session's snapshot until completion so updated content cannot change its
grading. Keep historical event meaning stable. For corrupt session state, explain
the issue and require a learner action before resetting that session only.

### Offline acceptance

- Successful preparation includes route shell, required JS/CSS, parser/preview,
  reviewed snapshot, and local storage. Home-page caching alone is insufficient.
- Expose readiness; failed preparation cannot display **Připraveno offline**.
- After preparation, test offline direct navigation and home-to-mode navigation,
  including a mode route not previously opened. No blank screen or homepage
  substituted for the expected exercise.
- Read installed Next.js App Router/PWA guidance before implementation. Handle
  HTML navigation and RSC requests compatibly; home HTML is not valid RSC recovery.
- Activate app/content updates coherently; pin active snapshots, announce updates,
  and prevent mixing incompatible chunks, shells, and curriculum.
- Delete only application-namespaced obsolete caches. Do not cache credentials,
  authentication endpoints, or private API responses.
- Display local-only progress honestly; do not claim queued server synchronization
  before the shared sync feature exists.

## 8. Work packages, dependencies, and estimates

Each row is a reviewable PR/work item. Estimates are working days for one developer
familiar with this repository, excluding SME turnaround and new infrastructure.
Re-estimate after parser/migration discovery.

| ID | Work and principal files | Depends on | Verifiable exit criteria | Days |
| --- | --- | --- | --- | ---: |
| NOM-01 | Seed/ledger review, policy fixtures, stable IDs, scope/difficulty; chemistry documentation | None | All 126 entries accounted for; editor/SME assigned; unresolved questions explicit | 1 |
| NOM-02 | `content/src/nomenclature-schema.ts`, import tooling, ID map, draft collection; `validate.ts` and tests | NOM-01 | Deterministic idempotent import; duplicate keys/IDs rejected; edited records preserved; 126/126 dispositions | 1–2 |
| NOM-03 | `packages/chemistry/src/parse-formula.ts`, tests, normalization contract, exports | NOM-01 | Full grammar/failure fixtures; eligible candidates parse; unsupported syntax rejected; no dependency cycle | 2–3 |
| NOM-04 | `evaluate-nomenclature-answer.ts`, conformance fixtures, alias/collision validation | NOM-02, NOM-03 | Both directions/policies pass positives/near misses; no ratio reduction or composition-only acceptance | 1–2 |
| NOM-05 | Reviewed runtime generator/artifact, versioning, build integration | NOM-02, NOM-04; SME for released content | Empty set valid; invalid reviewed record fails; raw drafts/metadata absent from bundle; accurate coverage | 1–2 |
| NOM-06 | v3 compatibility release, browser-store schemas, atomic attempts/checkpoints, migrations | NOM-01; shared-persistence coordination | Actual old-client upgrade path safe; legacy data/cards retained; duplicate/aborted writes and two-tab conflicts covered | 2–3 |
| NOM-07 | `apps/web/lib/nomenclature-session.ts`, route, `components/nomenclature-practice.tsx`, formula input/preview, home link | NOM-04, NOM-05, NOM-06 | Both complete keyboard flows; filters/scoring/retry/reveal/resume; empty/error states; 360 px | 2–3 |
| NOM-08 | Service worker/preparation; `apps/web/e2e/nomenclature.spec.ts`; update/migration/offline cases; docs/release review | NOM-05, NOM-06, NOM-07 | Production offline/update tests, full quality gate, reviewed release evidence | 2–3 |

Planning range: **12–19 developer days**, plus separately scheduled chemistry review.
Critical path: equivalence policy → parser/evaluator → reviewed snapshot and safe
persistence → UI → production offline QA. SME content review can proceed while
engineering implements contracts. Unsupported seed entries must not block a
smaller, explicitly scoped reviewed release.

Reuse `exercise-session.ts`; do not build a second session engine. Inspect shared
work before adding abstractions. A shared formula renderer is justified by the
question display and live preview; do not build speculative design-system layers.

Module ownership:

- `packages/chemistry/src/`: pure grammar, normalization, evaluation, fixtures.
- `content/src/`, `content/data/`, optional `content/staging/`: schemas, imports,
  authoring, validation, reviewed generation, provenance.
- `apps/web/lib/`: selection/session adapters and browser persistence.
- `apps/web/components/`, proposed route, and home: accessible learning UI.
- `apps/web/public/sw.js`, registration component: cache lifecycle/readiness.
- `apps/web/e2e/`: production browser evidence.
- Update `docs/chemistry-content.md`, `product-spec.md`, `architecture.md`,
  `testing.md`, and `SPRINT_PLAN.md` as behavior lands; preserve dated audit history.
- No feature changes planned for `apps/api` or `packages/contracts`. Future sync
  is a separate slice using canonical FastAPI OpenAPI and Alembic where needed;
  no independent Python chemistry grader.

## 9. Test matrix and acceptance fixtures

These are proposed expectations, not scientific approvals or executed test results.
New semantic aliases remain disabled until reviewed.

### Chemistry and content

| Fixture | Expected outcome |
| --- | --- |
| AgCl → `chlorid stříbrný`; reverse → `AgCl` | Canonical match in both directions |
| `  CHLORID   STŘÍBRNÝ  `; decomposed Unicode | Correct under both name policies |
| `chlorid stribrny` | Wrong in strict unless separately approved alias; correct in tolerant; match kind recorded |
| CuO → `oxid měďný` | Wrong in both policies; suffix is meaningful |
| Na2SO4 → `siřičitan sodný` | Wrong in both policies |
| Ca(H2PO4)2 → `hydrogenfosforečnan vápenatý` | Wrong; missing prefix is not tolerated |
| `CuSO₄.5H₂O`, `CuSO4 ⋅ 5H2O`, `CuSO4·5H2O` | Same canonical hydrate after successful parse |
| Pentahydrate prompt → `CuSO4` or `CuSO4·4H2O` | Wrong hydration |
| `Al2(SO4)3`, `(NH4)2SO4`, `(NH4)2Fe(SO4)2·6H2O` | Grammar positives; last record still needs advanced-content review |
| `Ca(OH2`, `Ca()2`, `H0`, `Xx2`, `H2O!`, `2H2O`, `Na+`, `H2O(aq)` | Full parse fails with stable reason |
| `CO`, `Co`, `co`, `C o` | Distinct chemical symbols retained; bad capitalization/spacing rejected |
| `Fe1.5O`, `CuSO4.`, `CuSO4..5H2O`, `CuSO4·0H2O` | No decimal/adduct/count guessing |
| `H[AuCl4]`, `K2[HgI4]`, nested parentheses | Unsupported initial grammar; not shipped |
| H2O2 versus `HO`; P4O10 versus `P2O5` | No global ratio reduction; latter pair needs reviewed formula policy/alias |
| Same atom counts, different order/grouping | Not automatically equivalent; explicit alias required |
| HCl → aqueous-acid name without corresponding context | Not an automatic alias |
| Alias present only in explanation | Not accepted |
| Duplicate IDs/keys, alias collisions, missing approval metadata, broken refs | Record-specific validation failure |
| Empty/mixed-status collection; changed answer/alias/context | Empty runtime valid; only reviewed eligible records; semantic version changes |
| Re-import after editor correction | No overwrite; deterministic conflict/report |

Also test exact grouped/hydrate atom counts, canonical parse/render round trips,
all safety limits/overflow, full-input consumption, and incomplete typing states.
Do not reproduce implementation algorithms to calculate test expectations.

### Application and persistence

| Layer | Required scenarios |
| --- | --- |
| Selection unit | OR categories/tags, AND difficulty/direction, hydrate deduplication, empty/single-item sets, length limits, seeded ordering |
| Session unit | Correct/incorrect/reveal, separate totals, one retry, empty/double submit, immutable settings, cleared solution on next/retry |
| Component | Both inputs, preview, IME Enter, labels/focus, policy reminders, loading/empty/error, reveal labeling, storage failure visible on results |
| IndexedDB integration | Fresh and prior DBs, preserved attempts/cards, active/feedback resume, corrupt checkpoint, unknown event schema, quota/denial, blocked/versionchange, atomic rollback, duplicate/conflicting event, two-tab revision conflict |
| Content updates | Resume pinned snapshot, new sessions use new version, missing snapshot recovery, no silent historical regrading |
| E2E formula-to-name | Complete happy and wrong-answer/retry paths; strict/tolerant differential; reveal; active/feedback reload |
| E2E name-to-formula | Complete happy and wrong-answer/retry paths; hydrate typography; wrong capitalization; accessible preview |
| E2E offline/update | Prepare then disconnect; direct/home navigation without prior route visit; finish/reload offline; app/content update; actual unsafe-old-client compatibility gate; no duplicate attempts |
| Accessibility/responsive | Explicit 360 px viewport plus current mobile project; keyboard-only complete session; text correctness cues; manual screen-reader and touch check |
| Regression | Periodic-table/name practice, element cards, shared session transitions, old attempts, cached routes, unchanged API/contracts |

Current Playwright mobile profile alone is not proof of 360 px support. Assert
stored event context/deduplication as well as visible results. Prefer accessible
roles/names when selecting controls.

## 10. Validation commands

Install committed locks using documented setup when dependencies are absent:

```bash
pnpm install --frozen-lockfile
uv --directory apps/api sync --frozen --extra test
```

Existing focused commands:

```bash
pnpm --dir packages/chemistry test
pnpm --dir content test
pnpm --dir apps/web exec vitest run lib/exercise-session.test.ts
pnpm --dir apps/web exec vitest run lib/browser-progress-store.test.ts lib/browser-learning-database.test.ts
pnpm content:validate
```

Run these additional proposed test paths after creating their files:

```bash
pnpm --dir packages/chemistry exec vitest run src/parse-formula.test.ts src/evaluate-nomenclature-answer.test.ts
pnpm --dir apps/web exec vitest run lib/nomenclature-session.test.ts components/nomenclature-practice.test.tsx
pnpm --dir apps/web exec playwright test e2e/nomenclature.spec.ts
```

Before declaring an implementation PR ready, run the full repository gate in
this order, from [testing.md](../../testing.md):

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
pnpm contracts:check
uv --directory apps/api run ruff format --check .
uv --directory apps/api run ruff check .
uv --directory apps/api run pytest -q
pnpm build
pnpm test:e2e
```

Playwright must exercise the production build, not an accidentally reused dev
server. Record actual outcomes and environment limitations. Passing code checks
does not replace chemistry review. Add import/generation scripts and their exact
commands to documentation when implemented; do not assume they already exist.

## 11. Release, rollback, and definition of done

Small increments can merge with an honest no-reviewed-content state. Expose only
categories supported by the released set. If fewer than 100 distinct logical
questions are approved, explicitly report the gap and do not mark Sprint 3 content
acceptance complete. Report distinct compounds too: reversed prompts must not
obscure a narrow content set.

Release requires both directions and scoring to meet this contract; source-backed
SME approval of every shipped name, formula, explanation, alias, context, and
difficulty; full seed disposition; no raw drafts/metadata in production; passing
offline/resume/update/migration/duplicate/keyboard/360 px tests; preserved legacy
attempts/cards; recorded manual checks; full repository gate and accurate docs.

Prefer roll-forward recovery. Withdraw a question with a new reviewed snapshot or
revert route exposure while preserving attempts and stable IDs. Scientifically
withdrawn content in a saved session needs an explicit recovery choice rather than
continued incorrect teaching. A rollback build must retain safe database handling
and compatible readers; never redeploy a client that deletes newer IndexedDB data.

No server migration is planned. If scope later adds one, supply the required
Alembic migration, compatibility/recovery notes, generated contracts, and API tests
before treating the expanded increment as complete.

## 12. Handoff status

- [x] Inspected code, applicable instructions, docs, active plans, ADRs, and scripts.
- [x] Preserved/audited the seed and defined per-record review disposition.
- [x] Defined contracts, work packages, tests, release gates, and downgrade risk.
- [ ] Assign content editor and chemistry SME; approve fixtures and candidate data.
- [ ] Implement NOM-01 through NOM-08 and record actual validation evidence.
- [ ] Complete production quality gate and release acceptance.

This planning task does not implement the feature, mark records reviewed, or claim
application tests passed.

Planning validation on 2026-09-22: `git diff --check` passed. A Python audit verified
all 126 seed values against the attachment, unique keys, hashes, all 126 ledger
rows, disposition counts, local Markdown links, and balanced code fences. The
ledger routes 86 records as core candidates, 34 for additional decisions, two to
deferred grammar, and four to deferred scope; all remain unreviewed. Biome is not
installed in this checkout. Application tests/build and the implementation quality
gate were not run for this documentation-only handoff.
