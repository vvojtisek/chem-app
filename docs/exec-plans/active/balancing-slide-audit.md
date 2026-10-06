# Balancing slide audit and quiz direction regression

The supplied iodine HTML presentation was audited across all 13 slides. It is a UX reference, not an independent scientific review. Existing owner-approved development status is preserved; no SME review is claimed.

| Slide / step | Development lesson mapping |
| --- | --- |
| 1 | Initial atom and charge count; every coefficient is one. |
| 2 | Conservation rules; coefficients versus subscripts. |
| 3 | Detailed initial count: I 2 = 2, O 3 vs 1, H 1 vs 2, charge -1 vs 0. |
| 4 | Oxygen: derive 3 H2O symbolically; write water after its dependencies. |
| 5 | Hydrogen: 6 H+; charge +4 vs 0. |
| 6 | Charge: 5 I-; I 6 vs 2. |
| 7 | Iodine: 3 I2; all atoms and charge agree. |
| 8 | Write 3 H2O last and check all conserved quantities. |
| 9 | Final lowest ratio 1:5:6:3:3. |
| 10 | Electron check and synproportionation. |
| 11 | Molar relationships and a structured thiosulfate titration equation. |
| 12 | Worked calculation for 0.1000 g KIO3, with compact structured numerical notes. |
| 13 | Balanced triiodide alternative and its charge ledger. |
| 14 | Standard final summary returning to the primary iodine equation. |

The titration relationships were cross-checked against [HIRANUMA's primary application note](https://www.hiranuma.com/en/product/titr/app/pdf/O3.pdf); triiodide context against [Florida State University's laboratory introduction](https://www.chem.fsu.edu/chemlab/chm3120l/redox/intro.html). These checks do not substitute for a registered chemistry-SME review. The slide's laboratory recipe and acid-dependent kinetic claim are not reproduced without appropriate review. The calculation is educational, not a laboratory protocol.

The supplied deck concerns iodine, not borax. Borax now has seven steps: an all-one initial count, conservation explanation, four existing balancing steps, and the standard final summary. A separate borax deck is still needed to claim exact 12+ slide matching for that reaction. A separate Screenshot 2 image was not supplied.

## UI and quiz behavior

Coefficient badges have three states: dotted muted unresolved, filled amber active in this exact step, and amber outlined resolved from earlier steps. Conceptual/result slides have no active coefficient; the final summary fills all resolved badges, including one. Formula element spans, summary symbols, and periodic-table tiles reuse the existing category CSS color tokens. The layout retains horizontal element/charge cards, compact navigation, mobile wrapping, and the reaction-information disclosure.

The nomenclature bug was a per-record direction fallback, not a reset of React direction state. Queues now exclude records unsupported by the selected direction. Direction is saved in the checkpoint and remains fixed through mistakes, retries, and reloads. Explicit toggling starts a new compatible series while preserving historical attempts. Older version-2 checkpoints are repaired against their saved preference, with a notice when incompatible records are removed.

## Changed files

- Balancing lesson component, CSS module, route header, and component/E2E tests.
- Shared formula rendering and new `apps/web/lib/element-display-colors.ts` presentation tokens.
- Balancing structured content, schema, and validation regression tests: all 114 lessons have appended final summaries; prior lesson steps change only for iodine, borax, and the coupled arsenic example.
- Nomenclature practice/session helpers and their component, unit, and E2E tests.
- Product/content documentation and this audit.

## Verification commands

```bash
pnpm --dir apps/web test
pnpm --dir content test
pnpm --dir apps/web typecheck
pnpm --dir content typecheck
pnpm content:validate
pnpm --dir apps/web build
DATABASE_URL='<isolated test database URL>' WEB_E2E_ORIGIN=http://127.0.0.1:3100 WEB_E2E_PORT=3100 API_E2E_PORT=8000 pnpm --dir apps/web exec playwright test e2e/element-study.spec.ts e2e/nomenclature.spec.ts --grep-invert offline
git diff --check
```

Scoped Biome checks cover changed TS/TSX/CSS files; the expanded JSON uses `--files-max-size=2000000 --json-formatter-expand=always`. Browser coverage includes 1366×768, 1024×768, 768×1024, and 360×800, all 13 iodine steps, badge transitions, stable navigation, signed charge, accessibility, all 114 reactions' initial/final viewport bounds, and multi-question nomenclature direction persistence. The final handoff reports the checks actually completed.

Previous handoff results (before the final-feedback/notation follow-up): 304 web unit/component tests, 68 content tests, and 22 desktop/mobile online Playwright tests passed. Web/content type checking, production web build, content validation, scoped Biome checks, and `git diff --check` passed. The local browser preview also showed the three-state borax badges and a repaired name-to-formula checkpoint; its existing attempt history was not manually changed during inspection.

The final-feedback/notation follow-up is documented in `quiz-feedback-notation-fixes.md`, including current validation results. The full repository/backend gate remains outside this local UI run. The previously observed release blocker (792 shipped records without current SME review, including all 114 balancing lessons) has not been resolved by this UI fix.

This is the previous local-preview audit. The subsequent v1.1.7 delivery is recorded in `pedagogical-balancing-derivations.md`. No LAN redeployment is included.
