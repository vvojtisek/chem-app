# Nomenclature foundation

## Goal

Prepare the deterministic contract for Czech inorganic nomenclature practice without publishing unreviewed chemical questions.

## Required reviewed record

Each question must define a stable ID, category, difficulty, direction (`formula-to-name` or `name-to-formula`), canonical formula, canonical Czech name, explicitly accepted aliases, source, author, review status, reviewer, and review date.

## Answer policy

- Normalization may handle Unicode composition, outer/repeated whitespace, and case where chemically safe.
- Missing diacritics, alternative suffixes, historical names, and hydrate notation are accepted only when explicitly listed as reviewed aliases.
- The evaluator must reject a chemically distinct formula or name even if it is textually similar.

## First deliverable

Implement schema validation, pure direction-aware answer evaluation, positive and negative fixtures, and an empty-state route that explains that reviewed questions are not yet available. Add curriculum records only after their chemistry review.
