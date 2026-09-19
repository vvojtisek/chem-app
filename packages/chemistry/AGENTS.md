# Chemistry domain instructions

This directory contains the highest-risk product logic. Chemical correctness and deterministic behavior take precedence over convenience or speed.

Read the repository-root `AGENTS.md`, `docs/chemistry-content.md`, relevant accepted ADRs, and the active implementation plan before changing this package.

## Boundaries

- Keep the package pure: no network, database, browser storage, React, Next.js, FastAPI, clock, randomness, locale-global mutation, or environment-variable dependencies.
- Accept inputs and return values/errors explicitly. Inject a clock or seeded generator only if a domain function genuinely needs one.
- Do not import from `apps/*`. Applications may adapt this package; this package must not adapt applications.
- Presentation formatting must not alter canonical chemistry values.
- Avoid runtime dependencies unless they clearly reduce correctness risk and are justified in the change.

## Determinism and public API

- The same validated input and options must always produce the same result.
- Export a small deliberate public API. Treat exported functions, result types, error codes, and normalization behavior as contracts.
- Prefer discriminated result unions over thrown exceptions for expected invalid chemistry input.
- Never use floating-point arithmetic for stoichiometric coefficients. Use integers and exact reduction.
- Preserve original input only for diagnostics; comparisons use canonical normalized structures.
- Do not infer a user's intended chemical meaning from a near match.

## Parsing and normalization

- Implement only the grammar documented in `docs/chemistry-content.md`.
- A parser must either consume the full input or return a typed failure with a position/reason. Partial parses are invalid.
- Separate lexical normalization, parsing, semantic validation, and display rendering.
- Validate element symbols against the reviewed element table rather than accepting any capitalized token.
- Hydrates, grouping, charges, equation arrows, coefficients, and aliases must follow documented canonical forms.
- Tolerant Czech matching is limited to documented normalization and explicitly approved aliases. Do not introduce edit-distance, phonetic, or generative matching.

## Equation and answer correctness

- Atom conservation is checked from parsed structures, not from string equality.
- Accepted balancing coefficients must be positive integers in the lowest whole-number ratio.
- UI blanks may normalize to coefficient one, but domain APIs must receive or return explicit canonical coefficients.
- A reaction content record is releasable only when both sides parse and automated balance validation succeeds.
- If charge balance is within the declared grammar, test it separately from atom balance.

## Fixtures and tests

- Every behavior change requires positive and negative fixtures.
- Bug fixes must add a regression fixture that fails before the fix.
- Include confusing near misses: wrong element capitalization, invalid subscripts, unmatched groups, hydrate-dot variants, wrong Czech suffixes, unapproved aliases, non-reduced coefficients, and atom-balanced-looking invalid strings.
- Prefer table-driven tests and human-readable fixture IDs tied to the behavior under test.
- Property-based tests are appropriate for invariants such as parse/render round trips and coefficient reduction, but do not replace curated chemistry examples.
- Shared conformance fixtures may be consumed by other runtimes; keep their format versioned and deterministic.

## Review requirements

Changes to grammar, normalization, nomenclature rules, accepted aliases, balancing semantics, or element data require chemistry-SME review. Record the reviewed fixtures and any intentional exclusions in the PR. A green test suite is necessary but does not replace scientific review.

Run the chemistry-package and content-validation commands from `docs/testing.md` before completion.
