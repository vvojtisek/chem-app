# Sprint Plan — Inorganic Chemistry Learning PWA

## 1. Delivery approach

The product will be delivered as an offline-first React application in one short inception sprint followed by six two-week delivery sprints. Each sprint must end with a usable, testable increment; content authoring and chemistry review run in parallel with development.

### Planning assumptions

- **Calendar:** 1-week Sprint 0, then six 2-week sprints (13 weeks total).
- **Team:** 2 frontend/full-stack developers, part-time UX designer, QA engineer, and a chemistry subject-matter expert (SME). If one person fills several roles, reduce the planned content volume rather than quality controls.
- **Architecture:** Next.js App Router + React + TypeScript + Tailwind CSS for the installable PWA; FastAPI + PostgreSQL for authenticated persistence and synchronization.
- **Storage:** versioned IndexedDB stores for curriculum, progress, attempts, sync queue, and spaced-repetition state; `localStorage` is limited to small non-sensitive preferences. Curriculum data is shipped as validated JSON/TypeScript assets.
- **Release target:** a Czech-language MVP that supports all four learning modes, works after the first online load, and is usable on desktop and mobile.

### MVP content target

The application mechanics and schema support the full curriculum, while the first release uses a reviewed content baseline:

- all 118 elements have identity, position, and category data for the periodic-table mode;
- the first 36 elements plus the most important industrial elements have reviewed occurrence and production content;
- at least 100 nomenclature questions, balanced across enabled categories and difficulties;
- at least 60 reviewed reaction questions, including coefficient and missing-part tasks;
- at least 30 reviewed mineral, production, and flashcard prompts.

Content volume is a release variable. Chemical correctness is not: unreviewed items must not be included merely to reach a count.

## 2. Product milestones

| Milestone | End of | Outcome |
|---|---:|---|
| Technical foundation | Sprint 1 | Installable offline shell, validated data, reusable exercise engine, local progress, API contract and persistence baseline |
| Internal alpha | Sprint 2 | Periodic-table learning mode complete end to end |
| Curriculum beta | Sprint 5 | All four learning modes available with reviewed baseline content |
| MVP release | Sprint 6 | Mastery views, accessibility, offline/recovery testing, release documentation |

## 3. Sprint-by-sprint plan

### Sprint 0 — Product definition and technical inception (1 week)

**Goal:** remove design and content ambiguity before feature development.

**Planned work**

- Confirm learner profile, curriculum level, supported browsers, and the boundary between MVP and later content expansion.
- Produce low-fidelity flows for home, mode setup, active question, answer feedback, result summary, and progress.
- Create the repository, quality gates, preview deployment, and production deployment pipeline.
- Define canonical schemas for elements, reactions, nomenclature, attempts, mastery, settings, and spaced-repetition cards.
- Define content ownership and a two-person review workflow: author plus chemistry SME approval.
- Create a content coverage matrix by topic, category, difficulty, and review status.
- Record architecture decisions for Next.js, FastAPI/SQLAlchemy, authentication, formula rendering, PWA caching, storage/synchronization versioning, and test tooling.

**Acceptance criteria**

- Critical user flows and navigation are agreed and visible in a clickable or low-fidelity prototype.
- A minimal application deploys to a preview URL through CI.
- Sample records for every entity pass runtime schema validation.
- The team agrees on the MVP content target and Definition of Done.

### Sprint 1 — Application foundation and shared exercise engine

**Goal:** establish the reusable platform needed by every learning mode.

**Planned work**

- Build the responsive application shell, navigation, mode cards, settings, and error boundary.
- Add the PWA manifest, service worker, install metadata, and an explicit offline state.
- Implement runtime validation for curriculum data, including unique IDs, atomic-number uniqueness, period/group bounds, and required localized fields.
- Implement a shared exercise-session state machine: setup, question, submitted answer, feedback, retry queue, summary, and restart.
- Store versioned attempts, settings, session summaries, mastery events, and pending sync events in IndexedDB; include safe defaults and recovery from invalid or old records.
- Establish the FastAPI service layers, PostgreSQL/Alembic baseline, stable OpenAPI operation IDs, and generated TypeScript client.
- Implement authenticated idempotent attempt-event synchronization according to the accepted authentication and persistence ADRs; local completion must never wait for synchronization.
- Create reusable formula display and input primitives. Keep a canonical plain-text value such as `H2SO4` and render a subscripted preview without changing the stored answer.
- Establish unit, component, end-to-end, accessibility, and data-validation test layers.

**Acceptance criteria**

- The application can be installed and reopened offline after one successful online load.
- A sample exercise can be completed, refreshed, and resumed without losing valid progress.
- Corrupt or unsupported local data produces a recoverable reset/migration path rather than a blank screen.
- Invalid curriculum data fails the build with a useful record identifier and error.
- Keyboard focus and screen-reader status messages work through the sample question and feedback flow.
- Repeating the same sync event does not create duplicate server records, and losing the network leaves it visibly queued for retry.

### Sprint 2 — Mode 1: blind periodic table

**Goal:** release the first complete learning mode and validate the common session engine.

**Planned work**

- Implement the 18 × 7 table plus separate lanthanide and actinide rows from data rather than hard-coded labels.
- Add scope filters: first 36, all 118, selected groups, d-block, metals, nonmetals, and metalloids.
- Implement both task directions: prompt-to-position and position-to-symbol/name, including four-choice answers where configured.
- Add immediate correct/incorrect feedback and an error queue repeated at the end of the session.
- Implement keyboard navigation and sufficiently large touch targets.
- On narrow screens, provide a clearly discoverable horizontal-scroll layout and preserve readable cell sizes.
- Record per-element attempts in the mastery event model created in Sprint 1.

**Acceptance criteria**

- All 118 elements render in their correct positions and every filter produces only eligible questions.
- The two exercise directions can each complete a session and generate an accurate summary.
- Incorrect elements reappear once in the end-of-session retry round without creating an infinite loop.
- The table is usable at 360 px width and at desktop width using touch, mouse, and keyboard.
- Chemistry SME approves the identity, symbol, group, period, and category dataset.

### Sprint 3 — Mode 3: inorganic nomenclature

**Goal:** support fast Czech formula/name practice without input friction.

**Planned work**

- Add multi-select filters for oxides, hydroxides, binary acids and salts, oxoacids, oxoacid salts, hydrogensalts, and hydrates.
- Implement formula-to-name and name-to-formula sessions.
- Normalize case, surrounding/repeated whitespace, Unicode composition, formula spacing, and equivalent dot notation for hydrates.
- Implement two answer policies: strict and tolerant. Tolerant mode may ignore missing diacritics and explicitly approved aliases; it must not silently accept chemically different terms.
- Show the normalized rendered formula as the learner types while retaining an editable plain-text input.
- Include difficulty in selection and results so content coverage can be assessed.

**Acceptance criteria**

- Any valid combination of selected categories produces only questions from those categories; an empty selection is handled clearly.
- Both task directions accept documented equivalent formatting and reject chemically different answers.
- Strict/tolerant behavior is covered by a chemistry-SME-approved table of positive and negative examples.
- At least 100 reviewed questions are available with no duplicate logical prompt/answer pair.
- A learner can complete the mode using only the keyboard.

### Sprint 4 — Mode 2: chemical equations and balancing

**Goal:** deliver reliable equation practice with explanatory atom-balance feedback.

**Planned work**

- Add filters by element and reaction category: production, characteristic, redox, and industrial.
- Implement coefficient inputs with a single normalization rule: blank coefficient and explicit `1` both mean one.
- Validate atom conservation independently from the stored expected coefficients and require the lowest whole-number ratio.
- Implement missing-reactant/product questions using text input and optional four-choice presentation.
- Add formula/equation rendering and an atom-balance table that compares each element on both sides after an incorrect answer or when help is requested.
- Add automated data checks that parse supported formulas and reject stored equations that are not balanced.

**Acceptance criteria**

- Correct lowest-ratio coefficient sets pass; zero, negative, decimal, incomplete, unbalanced, and proportionally inflated sets fail with appropriate feedback.
- Blank-versus-`1` behavior is consistent across keyboard entry, validation, results, and retry.
- The atom-balance aid reports correct left/right counts for every element in the supported test corpus.
- Missing-part answers use canonical normalization and accept only reviewed equivalent forms.
- At least 60 reaction questions pass automated balance checks and chemistry review.

### Sprint 5 — Mode 4: occurrence, production, and flashcards

**Goal:** complete curriculum coverage and introduce deliberate review over time.

**Planned work**

- Add filters by element and logical topic, including iron/steel, halogens, sulfuric acid, and nitric acid.
- Implement mineral-to-element matching, production-principle questions, and industrial condition prompts.
- Implement two-sided element flashcards with occurrence, important ores, laboratory preparation where applicable, industrial production, and equations.
- Add “Knew it / Didn’t know it” grading and a simple documented spaced-repetition schedule.
- Persist due dates and review history locally and show due-card counts without requiring an account.
- Run a complete chemistry review of high-risk industrial conditions, catalysts, temperatures, pressures, and equations.

**Acceptance criteria**

- Each question links back to a reviewed source record and displays only content relevant to the selected scope.
- Flashcard grades update the next due date deterministically; overdue cards are prioritized and survive restart/offline use.
- Changing the device clock or encountering a malformed due date does not corrupt the deck.
- The reviewed baseline contains at least 30 prompts/cards and covers every advertised MVP topic.
- All four learning modes are reachable and completeable in the offline production build.

### Sprint 6 — Mastery, quality hardening, and MVP release

**Goal:** turn the feature-complete beta into a trustworthy, releasable learning product.

**Planned work**

- Add the periodic-table mastery heatmap and per-mode summaries based on stored attempts.
- Define mastery using a minimum-attempt threshold and recent-answer weighting so one correct answer does not display as full mastery.
- Add a transparent legend, a no-data state distinct from poor mastery, and a non-color cue for every heatmap level.
- Add progress reset and local data export/import for recovery and transfer between browsers if capacity permits; reset is mandatory, export/import is the first descoping candidate.
- Verify authenticated synchronization across offline/online transitions, duplicate retries, expired sessions, and a second device.
- Complete accessibility, responsive, performance, install/update, cache-version, and storage-migration testing.
- Conduct moderated usability sessions with representative learners and fix release-blocking findings.
- Finalize learner help, privacy statement, content credits/sources, known limitations, and release runbook.

**Acceptance criteria**

- Heatmap calculations match known attempt fixtures and distinguish no data, low mastery, and high mastery without relying on color alone.
- Progress reset requires confirmation and removes only application-owned records.
- Core flows meet WCAG 2.2 AA checks for keyboard access, focus visibility, labels, status announcements, and contrast.
- The production build works offline after first load on the agreed desktop and mobile browser matrix.
- No open severity-1/2 defects; all shipped curriculum records have SME approval; release checklist is signed off by product, QA, and chemistry SME.

## 4. Cross-sprint workstreams

### Content pipeline

Content work starts in Sprint 0 and is reviewed at least one sprint before the feature that consumes it. Every record carries an authoring/review status outside the shipped runtime payload. Automated checks cover schema correctness, duplicate IDs, element placement, formula parseability, and equation balance; the SME remains responsible for scientific meaning and Czech terminology.

### Testing strategy

- **Unit tests:** normalization, coefficient reduction, formula parsing, atom counts, question selection, mastery, and spaced repetition.
- **Component tests:** inputs, feedback states, filters, table cells, cards, and keyboard behavior.
- **End-to-end tests:** one complete happy path and one error/retry path for every mode, offline launch, storage migration, and progress reset.
- **Content tests:** schema, uniqueness, referential integrity, coverage thresholds, parseability, and balanced equations.
- **Manual tests:** chemistry review, assistive technology, small-screen usability, PWA install/update, and cross-browser behavior.

### Definition of Done for every story

A story is done only when its acceptance criteria are met, automated tests pass, responsive and keyboard behavior are checked, user-facing Czech text is reviewed, relevant curriculum data has SME approval, analytics/mastery events are recorded where applicable, and documentation is updated. Work hidden behind a temporary flag may merge, but it does not count as a delivered sprint outcome.

## 5. Dependencies and critical path

1. Final schemas and content workflow are prerequisites for reliable feature work.
2. The shared exercise engine, formula primitives, persistence, and event model must land before individual modes.
3. Reviewed content must be ready before the relevant mode enters its sprint; chemistry review is therefore on the critical path.
4. Attempt events must be captured consistently from Sprint 2 onward so Sprint 6 mastery is based on real data.
5. Offline and storage migrations must be tested continuously; postponing them to release would put all user progress at risk.

## 6. Principal risks and mitigations

| Risk | Impact | Mitigation / trigger |
|---|---|---|
| Chemistry content is late or incorrect | Blocks release or teaches wrong material | Coverage matrix, SME review gate, automated equation/data checks; reduce volume before reducing review quality |
| Fuzzy matching accepts a wrong answer | Damages trust and learning | Whitelisted aliases, explicit positive/negative fixtures, strict mode, conservative tolerance |
| Periodic table is unusable on phones | Mode 1 fails a core audience | Validate the scroll interaction in Sprint 2 on real narrow devices; consider zoom only after usability evidence |
| PWA cache serves stale code/content | Learners see inconsistent versions | Version caches and stored data, test updates from each supported prior version, provide recovery UI |
| Browser storage is cleared, evicted, or reaches limits | Progress loss | Quota handling, authenticated idempotent sync, reset/recovery; add export/import if capacity remains |
| Four modes dilute quality | Schedule overrun | Keep the shared engine small, ship modes sequentially, enforce content thresholds and explicit descoping order |

## 7. Scope control

If capacity is lower than planned, descope in this order while preserving a coherent MVP:

1. Progress export/import.
2. Optional multiple-choice variants where a text-entry version already exists.
3. Advanced mastery trend charts beyond the required heatmap and summaries.
4. Content volume above the reviewed minimums.

Do not descope data validation, chemistry review, accessible feedback, local progress recovery, offline behavior, or the core task type of any advertised learning mode.

## 8. Post-MVP backlog

- Expanded reviewed content for all elements and advanced industrial chemistry.
- Expanded account features beyond the MVP progress-sync boundary, designed without placing credentials in browser persistence.
- Teacher-created question sets, class assignments, and progress export.
- More adaptive scheduling and difficulty selection based on observed mastery.
- Localization beyond Czech.
- Rich worked solutions and reaction-mechanism explanations.
- Anonymous product analytics only after consent, data minimization, and a clear privacy decision.

## 9. Delivery status (audited 2026-09-21, HEAD 4571e98)

### Sprint 1 — Application foundation and shared exercise engine (IN PROGRESS)

- [x] Shared exercise-session state machine with one bounded retry round
- [x] Runtime curriculum validation for element/group IDs, symbols, and atomic numbers
- [x] Versioned IndexedDB attempt-event and element-card stores
- [x] PWA manifest, service worker, offline reopen of the application shell
- [ ] Responsive shell — settings screen and error boundary outstanding
- [ ] Recoverable reset/migration path for corrupt or unsupported local data (BUG-004)
- [ ] Formula display and input primitives
- [ ] FastAPI persistence baseline beyond `GET /api/v1/health`; no Alembic revision exists
- [ ] Authenticated idempotent attempt-event synchronization
- [ ] Accessible focus management (blocked by BUG-001)

### Sprint 2 — Mode 1: blind periodic table (BLOCKED)

Cannot start until BLOCK-001 is resolved. Resolve BUG-006 before this sprint records
any real attempt data; critical-path item 4 makes the attempt model a prerequisite,
not a follow-up.

### Sprint 3 — Mode 3: inorganic nomenclature (NOT STARTED)

`docs/exec-plans/active/nomenclature-foundation.md` is written. No reviewed records exist.
The diacritics behavior shipped in 4571e98 contradicts that plan and must be reconciled
before nomenclature content lands (BUG-002).

## 10. Blockers and defect backlog

| ID | Sev | Title | Detail |
|---|---|---|---|
| BLOCK-001 | 1 | Group-3 membership makes the periodic grid ambiguous | `content/data/elements.json` assigns La, Lu, Ac and Lr all to group 3, so cells (period 6, group 3) and (period 7, group 3) hold two elements each; 92 elements with a group occupy 90 distinct cells. Needs a documented membership decision recorded as an ADR (IUPAC 2021 provisional recommends Sc, Y, Lu, Lr; many Czech textbooks still print La/Ac — the dispute is live and must be decided explicitly, not inherited), plus a `duplicate_position` validator in `content/src/validation.ts`. Sprint 2 AC "all 118 elements render in their correct positions" is unreachable until then. |
| BUG-001 | 2 | `pnpm lint` fails on main | `apps/web/components/element-name-practice.tsx`: `a11y/noAutofocus` at :115 and :140; `complexity/useOptionalChain` at :37 and :64. CI job `quality` is red; `main` is not releasable. |
| BUG-002 | 2 | Answer policy is unconditional and lives in a React component | `element-name-practice.tsx:38-45` decides tolerance inline with no strict/tolerant switch. Violates the AGENTS.md prohibition on chemistry validation inside React components and the `packages/chemistry` ownership of answer normalization and nomenclature rules. |
| BUG-003 | 2 | Error notices are unreachable | `notice` renders only in the active-question form. The empty-session message (:27) and the IndexedDB write-failure message (:56) are never visible to the learner. |
| BUG-004 | 2 | IndexedDB open has no blocked/version-error path | `apps/web/lib/browser-learning-database.ts:6` — no `onblocked` handler, so a blocked upgrade leaves the promise unsettled; no `VersionError` recovery for a downgraded client. |
| BUG-005 | 3 | `contentVersion` hardcoded in the UI | `element-name-practice.tsx:51` writes the literal `"elements-2026-09-19"`. `content/src/runtime.ts` must export a generated content version and the UI must consume it. |
| BUG-006 | 3 | Attempt model cannot support Sprint 6 mastery | `AttemptEvent` lacks `round`, `mode`, `direction` and `matchPolicy`, and is validated by a hand-rolled type guard rather than Zod. Fix before Sprint 2 records real data. |
| BUG-007 | 3 | Import statement placed after the component body | `apps/web/app/page.tsx:83`. Enable `assist.actions.source.organizeImports` in `biome.json`. |
| BUG-008 | 3 | Test-layer gaps | No component tests for `ElementNamePractice` or `ElementFlashcards`; no incorrect-answer/retry E2E for any mode (AGENTS.md requires one per mode); `page.test.tsx` not updated for the 4571e98 copy change. |
| BUG-009 | 3 | Element content review provenance is not SME-grade | All 118 records cite `reviewedBy: "Project curriculum approval"` against a conversation locator. Sprint 2 AC requires named chemistry-SME approval of identity, symbol, group, period and category. |
| BUG-010 | 3 | Sprint 5 scope built early without tests | `apps/web/components/element-flashcards.tsx` (413 lines) implements local card override/custom/reset ahead of its sprint, with no component test. |
| BUG-011 | 4 | Content inconsistencies pending SME adjudication | `Lr.valenceConfiguration` omits `5f14` while `Lu` includes `4f14`; `Lr.nameLat` is `Laurentium` rather than `Lawrencium`. |
| BUG-012 | 4 | Production build dirties tracked `next-env.d.ts` | `pnpm build` rewrites `.next/dev/types/…` to `.next/types/…`. Regenerate and commit, or untrack. |
