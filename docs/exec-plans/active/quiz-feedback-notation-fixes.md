# Final feedback, chemical notation, and balancing follow-up

Previous local-only handoff, before the v1.1.7 pedagogical-balancing PR. Current delivery is documented in `pedagogical-balancing-derivations.md`; no LAN redeployment is included.

## Scope and files

- `apps/web/components/final-answer-review.tsx` and the nomenclature, production, periodic-name, and blind-table quiz components: keep the evaluated final answer visible until the learner requests results. Grading, retry rules, scores, stored attempts, and explicit early stopping are unchanged.
- `element-flashcard-practice.tsx`: final button reads “Zobrazit výsledky”; timer expiry never hides already displayed feedback.
- `apps/web/components/chemical-text.tsx` and `apps/web/lib/chemical-text.ts`: reusable safe semantic presentation of canonical formulas, group/ion charges, atomic oxidation states, and arrows. Nomenclature feedback and balancing narrative/cards use it. All 469 shipped nomenclature explanations are covered by a notation regression audit.
- `apps/web/lib/element-display-colors.ts`, formula, balancing, and periodic explorer components: one existing category-token palette, with no duplicate per-symbol hex colors. Colored symbols use sufficiently large bold type; correctness still has words and symbols, not color alone.
- `content/data/balancing-reactions.json`: all 114 final summaries, plus a six-step coupled As/S/O/H/charge derivation for example 1.6. Existing intermediate steps elsewhere are preserved except earlier iodine/borax changes; they have not all been rewritten as SME-reviewed worked derivations.
- Balancing schema/validator and tests require a structured final summary with its atom and ionic-charge ledgers.
- Sodium-peroxide authoring data, generated nomenclature snapshot, second-seed explanation override, and importer support: explicit distinction between sodium/peroxide charges and atomic oxidation states; original archived seed stays unchanged.
- Component/content/browser regression tests and product/content documentation.

## Notation source and boundaries

[IUPAC's Red Book, IR-4.3 and IR-4.6](https://publications.iupac.org/books/rbook/Red_Book_2005.pdf) distinguishes ionic charges (right superscript, magnitude before sign) from Roman oxidation states. The renderer does not infer a real ion charge from an atomic oxidation state. Stored input and grading remain canonical/plain; HTML is escaped, not injected. Legacy parenthesized group annotations are recognized as the whole group's charge. Scientific approval remains a separate human review: no reviewer or status was upgraded.

## Local verification commands

```bash
pnpm --dir apps/web test
pnpm --dir content test
pnpm --dir apps/web typecheck
pnpm --dir content typecheck
pnpm --dir content generate:nomenclature
pnpm content:validate
pnpm content:release-check
NEXT_PUBLIC_SESSION_COOKIE_NAME=inorganic_session NEXT_PUBLIC_CSRF_COOKIE_NAME=inorganic_csrf pnpm --dir apps/web build
DATABASE_URL='<isolated test database URL>' WEB_E2E_ORIGIN=http://127.0.0.1:3100 WEB_E2E_PORT=3100 API_E2E_PORT=8000 pnpm --dir apps/web exec playwright test e2e/element-study.spec.ts e2e/nomenclature.spec.ts e2e/production-quiz.spec.ts e2e/home.spec.ts
git diff --check
```

Biome checks are scoped to changed source files; balancing JSON retains expanded formatting with an explicit large-file limit. Browser tests run against the loopback-only production preview, using the isolated test database. HTTP-local builds must use the same non-`__Host` cookie names as the local API; deployment on HTTPS retains its normal cookie configuration. The final handoff reports executed results and remaining skips, not an assumed full-repository pass.

## Executed results

- Web unit/component tests: 313 passed in 54 files. Content tests: 70 passed in 12 files.
- Playwright: all 74 tests passed across Chromium desktop/mobile in the four listed specs, including offline resume, correct/incorrect final retries, shared equation/card/table category tokens, all iodine steps, arsenic derivation, and initial/final viewport checks for all 114 lessons.
- Web/content type checks, production build, scoped Biome checks, content validation, and `git diff --check` passed.
- Loopback preview login returned HTTP 200; sampled referenced CSS and JavaScript assets returned HTTP 200 with correct MIME types. The final arsenic summary was also inspected visually in Chrome.
- Initial browser runs exposed a 0.27 px bottom overflow and two incorrect color-test assumptions (render readiness and hidden-table accessible labels). Reduced outer vertical padding, corrected the selectors, and reran the complete four-spec suite successfully without loosening assertions.
- `pnpm content:release-check` failed: 792 shipped records lack current SME review, including the 114 balancing lessons. This scientific-release blocker remains; parser/ledger success is not approval.
- Full-repository/backend/contracts/security gates were not run for this local frontend/content verification. Other imported intermediate derivations still need a full pedagogical/SME review.

The standalone preview stages both generated asset directories before starting:

```bash
cp -a apps/web/.next/static apps/web/.next/standalone/apps/web/.next/
cp -a apps/web/public apps/web/.next/standalone/apps/web/
PORT=3100 HOSTNAME=127.0.0.1 NEXT_PUBLIC_SESSION_COOKIE_NAME=inorganic_session NEXT_PUBLIC_CSRF_COOKIE_NAME=inorganic_csrf node apps/web/.next/standalone/apps/web/server.js
```
