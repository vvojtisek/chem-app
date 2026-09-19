# Curriculum content instructions

This directory contains authoring sources for curriculum data. Content is data, not application logic, and must be deterministic, traceable, validated, and reviewed before release.

Read the repository-root `AGENTS.md` and `docs/chemistry-content.md` before editing any record.

## Stable identity and structure

- Give every record a permanent lowercase, namespaced, hyphenated ID such as `reaction.haber-bosch` or `nomenclature.oxoacid.hno3-name`.
- Never recycle an ID for a different fact or question. If a record is replaced, deprecate it and create a new ID.
- Keep references by stable ID, not array position, filename order, display name, or database primary key.
- Follow the canonical schema. Do not add one-off fields without updating schema, validators, documentation, and fixtures.
- Keep ordering deterministic so generated diffs are reviewable.

## Review metadata

Every authoring record must include or inherit:

- authoring status: `draft`, `in-review`, `reviewed`, or `deprecated`;
- author or responsible editor;
- source references;
- reviewer and review date when status is `reviewed`;
- a content/schema version where required by the collection.

Personal reviewer metadata may be kept in authoring sources and removed from runtime output. Build tooling must exclude non-reviewed records from production curriculum bundles.

## Sources and scientific claims

- Cite a stable, identifiable source for nontrivial chemistry facts, especially industrial conditions, catalysts, temperatures, pressures, occurrence, preparation, and nomenclature exceptions.
- Prefer authoritative textbooks, curriculum materials, standards, and primary institutional sources.
- Do not use an AI-generated statement as the sole source.
- Quote sparingly and respect source licensing. Store facts and citations, not copied chapters.
- If reputable sources disagree, keep the item in review and document the chosen curriculum convention.

## Formulas, reactions, and aliases

- Store canonical plain-text formulas and equations according to `docs/chemistry-content.md`; rendering is derived.
- Every stored reaction must parse and pass atom-balance validation before review can complete.
- Use positive integer coefficients in the lowest whole-number ratio.
- Put accepted answers and aliases in explicit structured fields. Each alias must be chemically equivalent in the stated direction and Czech curriculum context.
- Do not add typo lists, broad fuzzy rules, or speculative synonyms to make a test pass.
- Add negative fixtures for plausible but incorrect answers whenever an alias or normalization rule changes.

## Authoring workflow

1. Add or update a draft record with sources.
2. Run schema, reference, formula, equation, uniqueness, and coverage validation.
3. Request chemistry-SME review for scientific meaning and Czech terminology.
4. Resolve review findings without weakening validators.
5. Mark the record reviewed with reviewer/date metadata.
6. Regenerate runtime content and verify that only reviewed, non-deprecated records ship.

Content-volume goals never justify bypassing this workflow. If review capacity is insufficient, ship fewer records and report the coverage gap.

## Change discipline

- Separate bulk mechanical normalization from factual content changes.
- Do not reorder unrelated records or regenerate all files for a small change.
- A content PR must state affected topics, validation commands, chemistry-review status, sources, and any coverage change.
- Run the content commands in `docs/testing.md` before completion.
