# Pedagogical balancing derivations — v1.1.7

## Scope

Replace coefficient-reveal placeholders in all 114 development lessons with auditable derivations; preserve formulas, source ratios, stable IDs, category order, offline presentation, and review status. Include the preceding locally verified layout, direction-lock, final-feedback, and notation fixes in the delivery. No database changes or LAN deployment.

## Method

- `packages/chemistry/src/derive-balancing.ts` derives coefficients from formulas and explicit charge, not saved answers. Exact bigint fractions produce conservation constraints, every elimination/division operation, rational ratios, and integer normalization. Unique non-H/O pairs precede distributed elements; ionic charge precedes H/O. An ambiguous or nonpositive system returns a typed failure rather than inventing coefficients.
- `content/src/derive-balancing-lessons.ts` is an offline authoring adapter. It records each constraint, its priority, LCM arithmetic for simple pairs, substitutions, normalization, and coefficients. Companion species use the same solved scale; water is written last. Persisted frames have independently validated ledgers. These are algebraic derivations, not inferred chemical mechanisms or a claim of SME-authored half-reactions for every neutral redox example.
- `content/src/regenerate-balancing-derivations.ts <lesson-index>` prints an `apply_patch` update to stdout. It never writes a file or reads saved answers to solve coefficients; saved ratios are an independent comparison that can reject a derivation. Run from `content` with `pnpm exec tsx src/regenerate-balancing-derivations.ts <index>`, apply the printed patch from the repository root, then run Biome formatting. The initial/formal equation, charges, and preserved references define the input.
- BF3 has the explicit five-slide inspection derivation: F priority, NSN(3,4)=12 and simultaneous 4/3 badges, missing B=4−3=1, water from O=3 and H=6, complete final check. The supplied prose incorrectly said oxygen was distributed; O actually appears in one species on each side. The corrected lesson does not repeat that claim.
- Borax, arsenic and the complete iodine presentation retain authored content. Arsenic now uses charge as an early constraint. Iodine derives water symbolically early but writes it after H, charge and I; all follow-up topics remain.
- Six peroxide/O2 skeletons are underdetermined by atom/charge conservation. Their explicit additional redox-model constraint is H2O2 → O2 + 2 H+ + 2 e− (one peroxide per O2). It is visible, source-attributed, and tested as an additional assumption, never disguised as an atom-count consequence. It uses acidic half-reaction bookkeeping; it does not assert that every overall reaction occurs in acidic medium.
- Both equation and card colors share periodic-table category tokens. An explicitly determined coefficient 1 retains its resolved outline on later steps.

## Sources and review

[OpenStax balancing by inspection](https://openstax.org/books/chemistry/pages/4-1-writing-and-balancing-chemical-equations) supports atom counting without changing subscripts. [OpenStax half-reaction balancing](https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions) supports separate charge/electron constraints and peroxide oxidation. Original VŠCHT source attribution remains. These sources and exact arithmetic are not SME approval. All 114 lessons remain owner-approved development content; scientific release remains blocked until registered review is performed.

## Verification and delivery

Run the commands in `docs/testing.md`, plus the new exact-domain and whole-dataset regression fixtures, BF3 badge/browser tests, all 114 initial/final viewport tests, and preceding final-feedback/offline tests. Biome's file-size limit is 8 MB because the complete persisted arithmetic trace exceeds its former default; no lint or chemistry rules are disabled.

The pre-existing nested checkouts cause root Biome configuration discovery errors. They were not modified or reformatted; the staged source tree was exported to a clean temporary snapshot for the full repository gate. The task-only safety stash, SQL backup, and existing worktrees are preserved. The PR must report actual results, chemistry-review status, and any remaining failures; do not merge it automatically.

## Executed validation

The clean snapshot passed the complete non-browser gate in `docs/testing.md`: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm content:validate`, `pnpm contracts:check`, `uv --directory apps/api run ruff format --check .`, `uv --directory apps/api run ruff check .`, `uv --directory apps/api run pytest -q`, and `pnpm build`. The final suite totals are 321 web tests, 164 chemistry tests, 75 content tests, and 44 API tests. No validation rules were weakened.

The loopback-only production build used `API_PROXY_TARGET`, `NEXT_PUBLIC_SESSION_COOKIE_NAME`, and `NEXT_PUBLIC_CSRF_COOKIE_NAME` aligned with its isolated HTTP-local API. The full `pnpm test:e2e` passed 110 tests with two existing guest-mode skips (guest login is disabled), covering desktop/mobile, offline mode startup, feedback/retry, synchronization, BF3 arithmetic/badges, all iodine slides, and all 114 initial/final viewport bounds. Longer explanations have reserved layout space; the original height and navigation-stability assertions remain intact.

API integration tests use an empty dedicated test database; browser tests use a different freshly migrated test database. An initial run against the older populated browser database failed assumptions about empty tables and the first page of attempts; no user data was deleted to address that. Initial layout failures were corrected and the full browser suite rerun successfully.

`pnpm content:release-check` still fails on 792 shipped records lacking current SME approval. The new descriptions, six model constraints, and all balancing lessons still require scientific/pedagogical review before a production release. Automated WCAG scans passed; broader manual screen-reader/physical-device verification was not performed. Login and sampled CSS/JavaScript assets returned HTTP 200 with correct MIME types. Chrome visual inspection confirms the BF3 LCM step and simultaneous active coefficients.
