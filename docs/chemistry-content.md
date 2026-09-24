# Chemistry domain and content contract

This document defines canonical chemistry input, normalization, validation, aliases, and review. It applies to `packages/chemistry`, curriculum authoring under `content/`, generated snapshots, and answer evaluation.

## Periodic-table flashcards

`content/data/elements.json` is the reviewed source for element cards. Each record has a stable ID, atomic number, symbol, Czech and Latin name, period, nullable group (for f-block records), relative atomic weight, valence configuration, review status, author, reviewer, and traceable source.

`content/data/groups.json` holds only named groups with explicitly approved Czech names and mnemonics. Validation rejects an unknown symbol, a duplicate symbol within a named group, or an element whose declared periodic group conflicts with that group.

User-created or locally edited cards are browser-local learning notes. They are not reviewed curriculum and must not be exported or treated as canonical content without a separate authoring and review workflow.

## Preparation and production by product

`content/data/preparation-production.json` stores the product-indexed material from the VŠCHT e-learning page identified in each record's `sources`. Equations keep reactants, products, integer coefficients, preparation/manufacture classification, source equation ID, and arrow conditions as structured fields. Prose notes remain separate from equations.

Owner-approved equations must parse with known element symbols, conserve every element, and use the lowest positive-integer coefficients. An equation that does not pass these checks remains `in-review` with a reason and is excluded from the runtime learning and quiz set. The current VŠCHT page's equation `id-20-91` for azoxide is unbalanced and is held out until its source is corrected or the intended formula is confirmed. Owner approval records source attribution and release permission; it is not a chemistry-SME review.

Every non-null `(period, group)` pair identifies exactly one element. Records with `group: null` are f-block entries and do not occupy a main 18-group grid cell.

## Principles

- Canonical stored data is plain text plus structured fields; typographic subscripts and rich rendering are derived.
- Parsing and evaluation are deterministic and consume the complete input.
- Scientific equivalence is explicit. Tolerance does not mean semantic guessing.
- Automated validation and chemistry-SME review are both release requirements.
- Unsupported notation fails with a typed reason rather than being partially interpreted.

## Supported formula grammar

The initial grammar supports:

- element symbols validated against the 118-element table;
- positive integer subscripts, with omitted subscript meaning one;
- adjacent element/group terms, for example `H2SO4`;
- parentheses with a positive integer multiplier, for example `Fe2(SO4)3`;
- a hydrate separator and positive leading count, for example `CuSO4·5H2O`;
- optional documented ionic charge notation only after a dedicated grammar fixture set is accepted.

The initial grammar does not silently support coordination complexes, structural formulas, variable-composition solids, isotopes, phases, or free-form prose. Additions require documentation, positive/negative fixtures, and SME review.

Canonical formulas use ASCII digits, exact element capitalization, parentheses, and `·` for hydrates. Store `H2SO4`, not visually subscripted `H₂SO₄`. Store `CuSO4·5H2O` as the canonical hydrate representation.

The current nomenclature parser accepts neutral formulas with non-nested parentheses, positive subscripts, and one terminal hydrate segment of the form `·nH2O` or `.nH2O`. It rejects charges, square brackets, phases, arbitrary adducts, nested groups, and partial parses. Input is limited to 256 characters, 128 terms, and count values of 1–999; accumulated atom counts must remain safe integers. Formula answers compare canonical notation or individually reviewed aliases, never atom counts alone. Czech names use the strict/tolerant/lenient rules below.

Stored nomenclature formulas may also use square brackets for coordination entities, nested groups, and structural notations (for example `K[Ag(CN)2]`, `FeFe2O4`); an ion stores its charge in a separate `charge` field and never in the formula. Such records are asked only from formula to name; the name-to-formula direction requires a neutral formula that the parser above reproduces exactly. A record may also be offered only from name to formula when the accepted variants of its name are undecided (for example H3PO3 under the hydrogen-prefix question R11).

`content/data/nomenclature.json` holds 510 records: the 126-item first seed and the 384 new entries of the 472-item second seed. `pnpm --dir content import:nomenclature` reports new drafts from the first seed; add `--write` to import them without overwriting edits. `pnpm --dir content import:nomenclature-2` does the same for the second seed, applying the per-entry decisions (corrections, omissions, directions, aliases, categories, held records) in `docs/exec-plans/active/nomenclature-seed-2-decisions.json`; a test verifies that the authoring data matches them exactly. `pnpm --dir content generate:nomenclature` creates the versioned runtime snapshot, and `pnpm content:validate` verifies it is current. An explicit content-owner release authorization on 2026-09-23 made 86 core entries of the first seed `owner-approved`; 40 remain drafts. A second authorization on the same day released 383 entries of the second seed, based on the owner's statement that it comes from VŠCHT materials; one entry (CuFeS2, R17) stays in review. This state is not chemistry-SME review. The generated record carries `reviewLevel`; at the owner's request (2026-09-23) the practice screen no longer shows a notice about owner approval, so `reviewLevel` must stay accurate in the data. A published record requires a scientific reference, real reviewer/date or owner approval, resolved issues, a category, at least one direction, and a valid formula. The review ledgers are `docs/exec-plans/active/nomenclature-seed-review.md` (first seed, issues R01–R16) and `docs/exec-plans/active/nomenclature-seed-2-review.md` (second seed, issue R17 and open SME questions).

## Formula normalization

Normalization occurs before parsing and may:

1. normalize Unicode to NFC;
2. trim surrounding whitespace;
3. convert Unicode subscript digits to ASCII digits;
4. remove permitted spacing around formula tokens;
5. convert approved hydrate separators (`.` or `⋅`) to `·` only when the grammar makes the hydrate meaning unambiguous.

Normalization must not repair element capitalization, invent missing brackets, change element symbols, infer a subscript, or discard unknown characters. Keep display transformation separate: a renderer may show subscripts but may not change the canonical stored/input value.

## Equation grammar and balance

An equation contains one or more formula terms on each side separated by `+` and one canonical arrow `->`. Input arrows such as `→` may normalize to `->`. Each term has an optional positive integer coefficient; omission means one.

Validation requires:

- every term parses fully;
- both sides are non-empty;
- all coefficients are positive integers;
- the count of each element is equal on both sides;
- accepted answer coefficients are divided by their greatest common divisor, producing the lowest whole-number ratio.

For UI coefficient entry, blank and explicit `1` both mean one. The domain boundary receives explicit integer arrays. Zero, negative, decimal, missing non-one coefficients, proportionally inflated ratios, and atom-imbalanced answers are rejected with stable reason codes.

If ionic charges enter the supported grammar, conservation of charge becomes a separate mandatory validation. Atom balance alone must not imply charge balance.

## Czech name normalization and aliases

Base normalization:

- Unicode NFC;
- trim leading/trailing whitespace;
- collapse repeated internal whitespace;
- locale-aware lowercase using the Czech locale;
- normalize only documented punctuation/spacing variants.

Strict mode compares normalized input with the normalized canonical answer and explicitly approved aliases.

Tolerant mode may additionally compare diacritics-stripped forms of the canonical answer and approved aliases. It does not use edit distance, phonetic matching, substring matching, translation, a language model, or automatic suffix repair.

Lenient mode, used for typed nomenclature names since 2026-09-23 at the content owner's request, extends tolerant mode deterministically (`normalizeLenientAnswer` and `compactLenientAnswer` in `packages/chemistry`): diacritics are removed (NFD, combining marks dropped), text is lowercased, spaces are collapsed and trimmed, every hyphen or dash variant (`-`, `‐`, `–`, `—`, `−`, …) becomes `-` with no spaces around it, and the answer is also compared with all spaces removed. `hexahydrat chloridu horecnateho` therefore matches `hexahydrát chloridu hořečnatého`, and `chlorid-chlornan vápenatý` matches `chlorid - chlornan vápenatý`. Lenient mode still never accepts a different word, suffix, prefix, typo, or extra word; validation rejects any two published names that would collide under it.

Aliases are stored per content record and answer direction. Each alias needs a reason when it is not a mere typography variant. An alias that is valid in one school convention but ambiguous elsewhere remains under review until the chosen curriculum policy is documented.

## Element answers by name or by symbol

Where a question asks for the chemical symbol or for the Czech name of an element (`evaluateElementAnswer(input, element, "symbol" | "name")` in `packages/chemistry`):

- A symbol is accepted only when it equals the canonical symbol exactly after trimming surrounding whitespace. Letter case is never corrected: for sodium `Na` is correct, while `na`, `NA` and `nA` are incorrect. A case-only mismatch is reported as `symbol-case-mismatch` so the learner can be told why.
- A name is compared with the Czech name normalization above, using the tolerant policy (missing diacritics accepted, with a hint).
- The other form is not accepted: the name is incorrect where the symbol is asked, and the symbol is incorrect where the name is asked. The Latin name, another element's name or symbol, a compound formula, inner spacing, and typos are incorrect. There is no fuzzy matching and there are no aliases.

## Stable IDs and references

- IDs are lowercase, namespaced, hyphenated, and immutable.
- References use IDs, never display names or array indexes.
- Removing a record does not make its ID available for reuse.
- Generated runtime snapshots include a schema version and content version.
- Attempts retain the content version and question ID needed to interpret historical progress.

## Authoring review fields

Each factual record includes or inherits:

```text
status: draft | in-review | owner-approved | reviewed | deprecated
author: responsible editor
sources: one or more identifiable references
reviewedBy: reviewer ID from content/data/reviewers.json, required for reviewed records
reviewedAt: ISO date required for reviewed records
reviewFingerprint: sha256 digest of the reviewed fields, required for chemistry-SME reviews
ownerApprovedBy/ownerApprovedAt: required for explicitly owner-approved nomenclature records
```

`content/data/reviewers.json` registers each reviewer once with a stable `reviewer.*` ID, a name, and a role: `chemistry-sme` (must state a qualification) or `curriculum-editor`. Only a `chemistry-sme` review satisfies the SME release requirement. A `curriculum-editor` approval keeps a record shippable during development but is reported as pending SME review.

`reviewFingerprint` covers every record field, including `sources`, except `status`, `author`, and the review fields themselves. If any covered field changes after the review, `pnpm content:validate` fails with `stale_review_fingerprint`. This enforces the rule below that a scientific change reopens review.

Runtime generation of element and group records includes only `reviewed` records that pass all validators. Nomenclature runtime generation includes `reviewed` records and the explicitly authorized `owner-approved` set, both subject to parser, collision, issue, and source validation. It excludes authoring-only personal metadata and every draft, in-review, or deprecated record. `owner-approved` must not be presented as SME-reviewed.

## Required fixtures

Maintain positive and negative fixtures for:

- simple and grouped formulas;
- nested/unsupported grouping boundaries;
- hydrates and ambiguous dot notation;
- invalid element symbols and capitalization;
- Unicode/ASCII subscript normalization;
- balanced, unbalanced, and non-reduced equations;
- blank coefficient versus explicit one;
- Czech diacritics, spacing, canonical names, and approved aliases;
- plausible but chemically incorrect names/formulas;
- every production incident caused by parser or answer-evaluation behavior.

Each fixture has a stable ID, input/options, expected structured result or stable error code, and a short purpose. Cross-runtime consumers must run the same versioned conformance set.

## Review workflow

1. Author adds a draft record and identifiable sources.
2. Automated validation checks schema, IDs, references, grammar, balance, aliases, and coverage.
3. Chemistry SME reviews scientific meaning, equations, Czech nomenclature, industrial conditions, and intended difficulty.
4. Author resolves findings and adds/updates negative fixtures where ambiguity was discovered.
5. The reviewer, registered as a `chemistry-sme`, records the review: `pnpm content:record-review --reviewer <reviewer-id> --date <YYYY-MM-DD> <record-id>...` (or `--all`). The command marks the records reviewed, stores the fingerprint, and refuses unknown or non-SME reviewers. Only the named reviewer, or someone acting on their explicit instruction, runs it.
6. Production generation proves that drafts, failed records, and deprecated records do not ship.
7. Before a release, `pnpm content:release-check` must pass: every shipped record has a current chemistry-SME review.

Review is reopened when a scientific field, canonical answer, alias, equation, production condition, or source changes. For an SME-reviewed record, validation enforces this. Either the SME re-records the review for the changed record, or the author sets `status: in-review` and removes the review fields, which stops the record from shipping until it is reviewed again. Pure formatting or metadata corrections may follow the documented lightweight review path once one exists.
