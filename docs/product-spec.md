# Product specification

## Product goal

Build a Czech-language, offline-capable learning application for inorganic chemistry. The product should help learners practice recall, receive immediate unambiguous feedback, revisit errors, and understand their mastery without requiring a continuous network connection.

The detailed delivery sequence is maintained in [`../SPRINT_PLAN.md`](../SPRINT_PLAN.md). This document is the stable behavioral baseline; implementation plans may split it into smaller increments but must not silently change it.

## Core learning modes

### Periodic-table practice

- Scopes: first 36 or all 118 elements; chemical groups; transition metals; metals, nonmetals, and metalloids.
- Prompt to position: show a Czech name or symbol and ask the learner to select the correct table cell.
- Both periodic-table exercises start with the same element selection step on the full table. The learner selects single elements, whole group columns 1–18 through their headers, or the La–Yb and Ac–No bottom rows as a whole. By default groups 1–18 are selected and both bottom rows are not (90 elements). Group headers and the bottom-row toggles are pills set apart from the element cells: green when fully selected, red and struck through when not selected, and amber with a dotted border when partly selected (`aria-pressed="mixed"`). Unselected element cells are dimmed and outlined with a dashed border. One selection is shared by both exercises and kept in the browser (`localStorage`); the start button shows the count, for example „Přejít na cvičení (90 prvků)“, and the summary offers „Změnit výběr“.
- During both exercises the table is fully blind: every unanswered cell, whether selected or not, shows the same „?“ with the same style, and no cell is highlighted, shaded or scrolled into view before an answer. A correct answer fills the cell green with its symbol until Reset. A wrong answer marks the cell with a red ✗ for 10 seconds, after which it shows „?“ again; the missed element returns at the end of the queue. A panel shows live correct and wrong counts, a stopwatch, Reset (restart with the same selection) and Ukončit (stop and show a summary). An exercise also ends when every selected element is answered.
- Prompt-to-position practice (blind table, `/procvicovani/periodicka-tabulka`) asks the selected elements in random order. Only the sought element and the table are shown, and each click is judged at once. Clicking a cell outside the selection counts as wrong. A cell showing ✗ cannot be clicked until the mark clears, unless it belongs to the sought element.
- Name and symbol practice (`/procvicovani/prvky`, also served at `/procvicovani/periodicka-tabulka/nazvy` from the same page) has two modes that can be switched at any time: Název → Značka (Czech name shown, exact symbol typed; letter case is never corrected) and Značka → Název (symbol shown, Czech name typed; missing diacritics are accepted with a hint). The mode is kept in the browser. The input is focused at the start and after every answer, and Enter submits. A wrong answer also flashes the input red for one second and shows the correct name and symbol in one line, then the exercise moves on at once. It replaces the earlier symbol-to-name series that lived at `/procvicovani/prvky`.
- Give immediate correct/incorrect feedback and repeat missed elements at the end of the session.

### Navigation

- `/procvicovani` lists the practice categories and their exercises, from the same catalog as the home page.
- Every exercise page (blind table, names and symbols, nomenclature, element flashcards) starts with a navigation bar that stays at the top while scrolling: „Zpět“ returns to `/procvicovani` and „Domů“ to `/`. The `/procvicovani` page itself offers only „Domů“.

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
