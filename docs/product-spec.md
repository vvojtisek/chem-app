# Product specification

## Product goal

Build a Czech-language, offline-capable learning application for inorganic chemistry. The product should help learners practice recall, receive immediate unambiguous feedback, revisit errors, and understand their mastery without requiring a continuous network connection.

The detailed delivery sequence is maintained in [`../SPRINT_PLAN.md`](../SPRINT_PLAN.md). This document is the stable behavioral baseline; implementation plans may split it into smaller increments but must not silently change it.

## Core learning modes

### Periodic-table practice

- Scopes: first 36 or all 118 elements; chemical groups; transition metals; metals, nonmetals, and metalloids.
- Prompt to position: show a Czech name or symbol and ask the learner to select the correct table cell.
- Prompt-to-position practice (blind table) is one continuous exercise over the whole table in random order. Only the sought element and the table are shown. Each click is judged at once: a correct cell turns green with the element symbol; a wrong cell shows a red ✗ for 10 seconds and cannot be clicked meanwhile, unless it belongs to the sought element. The missed element returns at the end of the queue. A panel shows live correct and wrong counts, a stopwatch, Reset (restart) and Ukončit (stop and show a summary). The exercise also ends when every element is placed.
- Name and symbol practice (`/procvicovani/periodicka-tabulka/nazvy`, replacing the earlier position-to-answer series at the owner's request on 2026-09-23) starts on the full table. The learner selects single elements, whole group columns 1–18 through their headers, or the La–Yb and Ac–No bottom rows as a whole. By default groups 1–18 are selected and both bottom rows are not (90 elements). Unselected elements are dimmed and outlined with a dashed border; a partly selected column or row is reported as mixed. The selection and the chosen mode are kept in the browser (`localStorage`) and restored on return. The start button shows the count, for example „Přejít na cvičení (90 prvků)“.
- The exercise has two modes that can be switched at any time: Název → Značka (Czech name shown, exact symbol typed; letter case is never corrected) and Značka → Název (symbol shown, Czech name typed; missing diacritics are accepted with a hint). All selected elements are asked in random order and the sought element's cell pulses blue in the table below; elements outside the selection are dimmed. The input is focused at the start and after every answer, and Enter submits. A correct answer fills the cell green with its symbol until Reset. A wrong answer flashes the input and the cell red for one second, shows the correct name and symbol in one line, counts as wrong, and moves on at once; the missed element returns at the end of the queue. The same panel as the blind table shows the counts, a stopwatch, Reset and Ukončit; the summary offers „Změnit výběr“.
- Give immediate correct/incorrect feedback and repeat missed elements at the end of the session.

### Chemical equations

- Filter questions by element and by production, characteristic, redox, or industrial category.
- Ask for coefficients using positive integers; a blank UI coefficient and explicit `1` both normalize to one.
- Require the lowest whole-number coefficient ratio.
- Ask for missing reactants or products by text entry or configured multiple choice.
- On error or request, show atom counts on both sides as a learning aid.

### Inorganic nomenclature

- Support oxides, hydroxides, binary acids and their salts, oxoacids, oxoacid salts, hydrogensalts, and hydrates.
- Support formula-to-Czech-name and Czech-name-to-formula practice.
- Normalize case, whitespace, Unicode, and documented formula typography.
- Strict mode accepts canonical answers and approved aliases. Tolerant mode may additionally ignore diacritics as documented; it does not guess semantic intent.

### Occurrence, production, and flashcards

- Filter by element or logical topic such as iron/steel, halogens, sulfuric acid, or nitric acid.
- Cover mineral-to-element matching and the principles, conditions, and equations of important production processes.
- Provide two-sided element cards with occurrence, important ores, preparation, production, and equations where applicable.
- “Knew it / Didn’t know it” grading drives a deterministic spaced-repetition schedule.

## Shared behavior

- Curriculum data is validated structured data, never duplicated inside UI components.
- Formula entry uses editable plain text such as `H2SO4` with an immediate typographic preview such as `H₂SO₄`.
- The desktop periodic table uses the standard 18-group layout plus lanthanide/actinide rows. At 360 px width it remains readable through a discoverable overflow interaction.
- All core interactions work with keyboard, pointer, and touch.
- Correctness, errors, selection, and mastery never rely on color alone.
- Attempts, retry state, mastery events, settings, and spaced-repetition state survive reloads and are migrated or recoverably reset across schema versions.
- After a successful initial load, core learning modes remain usable without a network connection.
- A mastery heatmap distinguishes no data from low mastery and uses a minimum evidence threshold so one correct answer is not presented as full mastery.

## MVP content baseline

- identity, table position, and category for all 118 elements;
- reviewed occurrence/production records for the first 36 elements and important industrial elements;
- at least 100 reviewed nomenclature questions;
- at least 60 reviewed reaction questions;
- at least 30 reviewed occurrence, production, or flashcard prompts.

These are planning targets, not permission to ship unreviewed material. If review capacity is constrained, correctness wins over volume.

## Out of scope for the first release

- mandatory accounts or online connectivity for core practice;
- teacher/classroom administration;
- user-authored public curriculum;
- semantic or generative answer grading;
- full coverage of advanced coordination chemistry;
- competitive scoring that treats client-recorded mastery as trusted evidence.
