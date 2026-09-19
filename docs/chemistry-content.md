# Chemistry domain and content contract

This document defines canonical chemistry input, normalization, validation, aliases, and review. It applies to `packages/chemistry`, curriculum authoring under `content/`, generated snapshots, and answer evaluation.

## Periodic-table flashcards

`content/data/elements.json` is the reviewed source for element cards. Each record has a stable ID, atomic number, symbol, Czech and Latin name, period, nullable group (for f-block records), relative atomic weight, valence configuration, review status, author, reviewer, and traceable source.

`content/data/groups.json` holds only named groups with explicitly approved Czech names and mnemonics. Validation rejects an unknown symbol, a duplicate symbol within a named group, or an element whose declared periodic group conflicts with that group.

User-created or locally edited cards are browser-local learning notes. They are not reviewed curriculum and must not be exported or treated as canonical content without a separate authoring and review workflow.

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

Aliases are stored per content record and answer direction. Each alias needs a reason when it is not a mere typography variant. An alias that is valid in one school convention but ambiguous elsewhere remains under review until the chosen curriculum policy is documented.

## Stable IDs and references

- IDs are lowercase, namespaced, hyphenated, and immutable.
- References use IDs, never display names or array indexes.
- Removing a record does not make its ID available for reuse.
- Generated runtime snapshots include a schema version and content version.
- Attempts retain the content version and question ID needed to interpret historical progress.

## Authoring review fields

Each factual record includes or inherits:

```text
status: draft | in-review | reviewed | deprecated
author: responsible editor
sources: one or more identifiable references
reviewedBy: required for reviewed records
reviewedAt: ISO date required for reviewed records
```

Runtime generation includes only `reviewed` records that pass all validators and excludes authoring-only personal metadata where appropriate.

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
5. Reviewer marks the record reviewed with identity/date.
6. Production generation proves that drafts, failed records, and deprecated records do not ship.

Review is reopened when a scientific field, canonical answer, alias, equation, production condition, or source changes. Pure formatting or metadata corrections may follow the documented lightweight review path once one exists.
