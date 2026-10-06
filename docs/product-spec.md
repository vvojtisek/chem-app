# Product specification

## Product goal

Build a Czech-language, offline-capable learning application for inorganic chemistry. The product should help learners practice recall, receive immediate unambiguous feedback, revisit errors, and understand their mastery without requiring a continuous network connection.

The detailed delivery sequence is maintained in [`../SPRINT_PLAN.md`](../SPRINT_PLAN.md). This document is the stable behavioral baseline; implementation plans may split it into smaller increments but must not silently change it.

## Core learning modes

### Periodic-table practice

- Scopes: first 36 or all 118 elements; chemical groups; transition metals; metals, nonmetals, and metalloids.
- Prompt to position: show a Czech name or symbol and ask the learner to select the correct table cell.
- Both periodic-table exercises start with the same element selection step on the full table. The learner selects single elements, whole group columns 1–18 through their headers, or the La–Yb and Ac–No bottom rows as a whole. By default groups 1–18 are selected and both bottom rows are not (90 elements). Group headers and the bottom-row toggles are pills set apart from the element cells: green when fully selected, red and struck through when not selected, and amber with a dotted border when partly selected (`aria-pressed="mixed"`). Unselected element cells are dimmed and outlined with a dashed border. One selection is shared by both exercises and kept in the browser (`localStorage`); the start button shows the count, for example „Přejít na cvičení (90 prvků)“, and the summary offers „Změnit výběr“.
- During both exercises the table is fully blind: every unanswered cell, whether selected or not, shows the same „?“ with the same style, and no cell is highlighted, shaded or scrolled into view before an answer. A correct answer fills the cell green with its symbol until Reset. A wrong answer marks the cell with a red ✗ and a countdown of the seconds left for 10 seconds, after which it shows „?“ again; the missed element returns at the end of the queue. A legend under the table explains the three cell states. In the blind-table exercise the sought element sits in a bar pinned under the top bar, so it stays in view while the table scrolls. A panel shows the position in the set („12 z 90“ with a progress bar), live correct and wrong counts, a stopwatch, Reset (restart with the same selection, after an inline confirmation) and Ukončit (stop and show a summary). An exercise also ends when every selected element is answered.
- Prompt-to-position practice (blind table, `/procvicovani/periodicka-tabulka`) asks the selected elements in random order. Only the sought element and the table are shown, and each click is judged at once. Clicking a cell outside the selection counts as wrong. A cell showing ✗ cannot be clicked until the mark clears, unless it belongs to the sought element.
- Name and symbol practice (`/procvicovani/prvky`, also served at `/procvicovani/periodicka-tabulka/nazvy` from the same page) has two modes that can be switched at any time: Název → Značka (Czech name shown, exact symbol typed; letter case is never corrected) and Značka → Název (symbol shown, Czech name typed; missing diacritics are accepted with a hint). The mode is kept in the browser. The input is focused at the start and after every answer, and Enter submits. A wrong answer also flashes the input red for one second and shows the correct name and symbol in one line, then the exercise moves on at once. It replaces the earlier symbol-to-name series that lived at `/procvicovani/prvky`.
- Give immediate correct/incorrect feedback and repeat missed elements at the end of the session.

### Navigation

- `/procvicovani` lists the practice categories and their exercises, from the same catalog as the home page. Every catalog link launches an exercise under `/procvicovani/*` or `/flashcards/*`; read-only study pages live under `/uceni` and are reached from Učivo.
- The authenticated application has one navigation landmark („Hlavní navigace“) with four primary destinations: „Domů“ (`/`), „Procvičovat“ (`/procvicovani`, also active for every exercise and `/flashcards/*`), „Učivo“ (`/uceni/prvky`, active for `/uceni/*`), and „Pokrok“ (`/pokrok`). From 768 px it is a side rail; on narrower screens it is a tab bar fixed to the bottom edge. The active destination has `aria-current="page"`.
- „Nápověda“ (`/napoveda`), „Profil“ (`/ucet`) and, for administrators, „Správa“ (`/admin`) sit at the bottom of the rail; on phones „Nápověda“ and „Profil“ are icon links in the top bar. A sticky top bar shows the account badge (guest or tester) and the synchronization status on every screen size. Pokrok contains personal progress; Profil contains account identity and password controls.
- Every screen below a primary destination starts with a breadcrumb trail („Drobečková navigace“), for example Procvičovat › Názvosloví, whose first item returns to the destination. Exercises no longer carry their own „Zpět“/„Testy“ bar.
- The home page (`/`) is a dashboard. The most recently saved exercise on this device (nomenclature, blind table, names and symbols) comes first with its position in the set and the only filled „Pokračovat“ button; other unfinished exercises are links. Four area cards follow: Periodická tabulka, Chemické rovnice, příprava a výroba, Názvosloví, and Učivo. Practice actions are compact links. For registered users and admins, cards show mastery or accuracy from attempts stored on this device. Guests and testers see cards without progress. The shell shows the app version.
- Registered users and admins can set an optional daily answer goal of 1–500 in their profile. The goal is saved on their server account and follows them across devices. The dashboard counts all answers, including wrong answers and retries, in the device's local calendar day from its locally available attempt history. A cached last-known goal permits offline display; changing the goal requires a connection.
- Targeted review („K zopakování“) lists up to five rated elements below mastery (at least three attempts and a weighted accuracy under 80 %), weakest first, on the home page and on `/pokrok`. Its action makes these elements the shared periodic-table selection and opens the blind table; while a blind-table exercise is unfinished it instead links to that exercise, because the saved exercise keeps its own selection.
- The home page links to `/uceni/prvky` in a new tab. This read-only learning set browses reviewed element and group records without questions or attempt tracking. The page starts with three study-material links (the periodic-table explorer `/uceni/prvky/tabulka`, element cards `/uceni/karty-prvku`, and preparation and production `/uceni/priprava-vyroba`), followed by the element index: a search field (Czech or Latin name without regard to case or diacritics, symbol, or atomic number; exact symbol and number hits first), category tabs („Vše“ and one per element category, each with a colour swatch, label and count; `aria-pressed`), and a collapsed „Skupina a perioda“ disclosure with the group filter (1–18 and the f-block rows without a group number) and the period filter. Results are grouped under category headings as category-tinted tiles. The chosen element's detail shows its category, facts, group and group mnemonic, and its reviewed preparation and production routes with typeset equations; from 1024 px it is a sticky side panel, below that it follows the results and „Zpět na přehled prvků“ returns focus to the chosen tile. The chosen element is mirrored in the URL hash (`#prvek-cl`), so a detail can be linked and reopened offline. A filtered group also shows its mnemonic above the results. The group overview with all mnemonics stays available in a collapsed section below the browser. Elements are not grouped into s/p/d/f blocks because the reviewed data has no block field.

### Chemical equations

- Filter questions by element and by production, characteristic, redox, or industrial category.
- Ask for coefficients using positive integers; a blank UI coefficient and explicit `1` both normalize to one.
- Require the lowest whole-number coefficient ratio.
- Ask for missing reactants or products by text entry or configured multiple choice.
- While coefficients are entered, a live table shows the atom count of every element on both sides with a ✓/≠ status; each coefficient has − and + steppers next to its number field. After an incorrect answer the atom counts of the answer are shown, and a balanced answer that is not in the lowest whole-number ratio is explained as such.
- Formulas in equations, prompts and feedback are typeset with real subscripts and superscripts (charges use a true minus sign); assistive technology reads the plain notation, for example „SO4 2-“.

### Inorganic nomenclature

- Completing any finite quiz queue shows the last answer's correction and explanation before the overall summary. The keyboard-focused „Zobrazit výsledky“ button is the only normal completion transition. Correct and incorrect final retries use the same review flow; clicking it does not record another attempt. Explicit „Ukončit“ still stops immediately. Flashcards retain displayed feedback even if their timer expires while the learner is reading it.

- Support elements and simple ions, oxides, hydrides, oxygen-free and oxoacids, hydroxides, salts of both acid kinds (hydrogensalts and hydrates included), coordination compounds and complex ions, and a small „Další“ group (organic and trivial names).
- The page `/procvicovani/nazvoslovi` has only the heading „Procvičování: Názvosloví“. It opens with a filter step: category pills (multi-select) with the number of matching items, quick selections of common anion families inside the two salt categories (for example Chloridy, Sírany; shown for families with at least three items), and a segmented element-count choice `1 | 2 | 3 | 4 a více | Všechny`. Categories and element count combine with AND; a quick family narrows only its own category. The start button shows the count, for example „Spustit cvičení (42 sloučenin)“, and is disabled with a warning when nothing matches. The last filters are kept in the browser.
- During a nomenclature prompt, „Nevím“ records an incorrect answer and reveals the correct pair. Incorrect feedback compares the learner's submitted text or „Nevím“ with the correct answer. Center the prompt formula or name in the question box.
- Choose Vzorec → Název / Název → Vzorec before starting or during practice. The exercise asks every filtered item supporting that direction once in random order; counts exclude incompatible records. The direction stays fixed across correct answers, mistakes, retries, and reloads, with no per-record fallback. Explicitly switching direction during practice starts a new compatible series, resetting its counters and stopwatch but retaining attempt history. Ions, coordination notation, structural or duplicate notations, mixed-anion formulas without one fixed element order, and the „Další“ group support only formula to name; a name whose accepted variants are still undecided supports only name to formula.
- The dashboard (position in the set, correct and wrong counts, stopwatch, Reset with confirmation, Ukončit) sits under the heading, followed by the direction switch, the prompt in large type, and an input focused after every answer. Enter submits and the next item follows at once; a feedback card under the next prompt shows the verdict of the previous answer, the correct pair, the exact spelling when a lenient name was accepted, and after a mistake also the stored explanation. A wrongly answered item returns at the end of the queue.
- An unfinished exercise resumes after a reload or offline restart; a changed curriculum or a series saved by the earlier version ends it with a notice, keeping the attempt history.
- Version-2 checkpoints now save the session direction explicitly. Older version-2 checkpoints use the device's saved direction and remove incompatible queued records with a notice; if no compatible record remains, the saved series is cleared without deleting attempt history.
- Typed names are compared leniently (see `docs/chemistry-content.md`): case, diacritics, spacing, dash variants, and word breaks do not matter, and an answer accepted only this way shows the exact spelling. No other variation is accepted. Formulas are compared in canonical notation with approved formula aliases. Both correct and incorrect feedback retain the authored explanation, with semantic formula counts, ion charges, oxidation states, and typographical arrows.

### Occurrence, production, and flashcards

- Filter by element or logical topic such as iron/steel, halogens, sulfuric acid, or nitric acid.
- Cover mineral-to-element matching and the principles, conditions, and equations of important production processes.
- Provide two-sided element cards with occurrence, important ores, preparation, production, and equations where applicable.
- “Knew it / Didn’t know it” grading drives a deterministic spaced-repetition schedule.
- `/flashcards/prvky` is a timed five-minute recall exercise. Learners choose elements using the shared periodic-table selection and toggle between recalling symbols from Czech names and names from symbols. They may also select proton number, relative atomic weight, and valence configuration as additional required answers. All selected fields must be filled before submission; „Nevím“ reveals them without requiring input. The result compares each submitted field with the reviewed value. A card scores correct only when every selected field is correct. Cards are shuffled at start; the HUD shows correct, incorrect, remaining, and time; Reset restarts the same selection, while Ukončit shows current results.
- `/uceni/karty-prvku` contains the browsable two-sided element cards and device-local edits. The card picker shows only the prompt symbol. The Czech name is not exposed until the learner flips the card.

### Preparation and production equation practice

- `/uceni/priprava-vyroba` is a read-only study set organized by product. It shows source notes, approved preparation/manufacture equations, and stated arrow conditions without asking questions or recording attempts. Element study cards link the applicable preparation/production material for pure elements.
- `/uceni/prvky` shows the element groups and their current approved mnemonics; where supplied, a disclosure also presents the owner-provided alternative mnemonic and explanation for traditional I–VIII A groups. Its „Periodická tabulka“ study-material link opens `/uceni/prvky/tabulka`, a blind 18-group table with seven periods and detached lanthanide/actinide rows. Cells show only proton numbers until selected; selecting a cell opens the reviewed element details in a modal that closes by button, Escape, or backdrop click and returns focus to the selected cell.
- `/procvicovani/rovnice` offers three levels from the same structured VŠCHT source: Beginner sees every formula and fills stoichiometric coefficients on both sides; Advanced sees reactants, enters product formulas, then fills coefficients; Profík is prompted with a target product and enters one or more complete manufacturing equations accepted for that product.
- `/procvicovani/priprava-vyroba` („Kvíz: Příprava a výroba látek“) is a multiple-choice quiz. A settings step chooses the routes (Vše, Příprava, Výroba, with counts) and the number of questions (10, 20, Všechny). Each question shows the reactant side of one reviewed route with its coefficients, the route kind and its arrow conditions, then asks „Kterou látku lze takto připravit/vyrobit?“ with four options (Czech name and typeset formula). Only routes whose products include their own product are asked, identical routes cited twice are asked once, and wrong options never include a substance of the route or a product of another route with the same reactants. Answers are graded by product ID. The shared dashboard, summary and „K zopakování“ list follow the other exercises; a wrong answer returns once at the end. Quiz results are session-only and are not recorded as attempts until the attempt contract has a mode for them.
- Typed product sides accept exact formula terms in either order. Profi equations accept complete, balanced source-approved alternatives with `->` or `→`; they do not use fuzzy chemical matching.
- Source equations must pass formula, atom-balance, and lowest-coefficient validation before they enter the study set or practice pool.
- Equation practice records each completed answer, including incorrect answers and retries, as a local attempt that synchronizes to the account's progress. Incorrect answers show reactant and product atom counts.

## Shared behavior

- `/napoveda` explains study, practice, offline use, synchronization, progress reset, and curriculum review status. `/soukromi` summarizes the data handled by the app and links to the deployment owner's privacy notice; both pages are part of the offline shell. `/soukromi` is readable without signing in and is linked from registration (ADR 0010). The current privacy page is explicitly incomplete until the deployment owner fills in identity, contact, retention, and erasure details.

- Learning routes require an authenticated account or a read-only guest
  session. Public registration uses email verification, and the learner sets
  their password from the verification link. A previously verified account
  can open the cached learning shell offline; synchronization requires a valid
  server session.
- Attempt history synchronizes across devices after the learner signs in and
  chooses whether to import legacy local attempts. Checkpoints, flashcard edits,
  and other learning state remain local to the account's device.

- Curriculum data is validated structured data, never duplicated inside UI components.
- Formula entry uses editable plain text such as `H2SO4` with an immediate typographic preview such as `H₂SO₄`.
- The desktop periodic table uses the standard 18-group layout plus lanthanide/actinide rows. At 360 px width it remains readable through a discoverable overflow interaction.
- All core interactions work with keyboard, pointer, and touch.
- Correctness, errors, selection, and mastery never rely on color alone.
- Element categories (alkali metals, alkaline-earth metals, transition metals, other metals, metalloids, nonmetals, halogens, noble gases, lanthanoids and actinoids) have one shared colour set: tokens in `apps/web/app/globals.css`, the classifier `classifyElementCategory` in `packages/chemistry`. Category colour always comes with the category name. It appears on study surfaces (`/uceni/*`), on the „K zopakování“ list in `/pokrok`, and in practice only after the element has been answered (feedback, revealed card side); the blind table, prompts and card fronts never show it, because it would hint at the answer.
- Attempts, retry state, mastery events, settings, and spaced-repetition state survive reloads and are migrated or recoverably reset across schema versions.
- Attempts are client-reported, self-study data; ranks are not verified assessments or competitive scores.
- After a successful initial load, core learning modes remain usable without a network connection.
- A mastery heatmap distinguishes no data from low mastery and uses a minimum evidence threshold so one correct answer is not presented as full mastery.
- `/pokrok` shows a summary (rank, progress to the next rank, attempts, correct answers, accuracy) with a 30-day chart that has a scale, gridlines, the daily average and today's bar emphasized; accuracy per mode as bars; targeted review; and the periodic-table mastery heatmap.
- Registered users and admins can reset their own progress from the „Nebezpečná zóna“ section of `/ucet` after a second explicit confirmation while online; the same section holds „Odhlásit a smazat data z tohoto zařízení“. This hides prior attempt history, rank, trend, and mastery on all synchronized devices and clears account-local pending attempts and unfinished practice, while preserving account identity, preferences, and custom cards. Old server events remain archived for quota accounting; reset is not a personal-data erasure request.

## MVP content baseline

- identity, table position, and category for all 118 elements;
- reviewed occurrence/production records for the first 36 elements and important industrial elements;
- at least 100 reviewed nomenclature questions;
- at least 60 reviewed reaction questions;
- at least 30 reviewed occurrence, production, or flashcard prompts.

These are planning targets, not permission to ship unreviewed material. If review capacity is constrained, correctness wins over volume.

## Out of scope for the first release

- account linking;
- teacher/classroom administration;
- user-authored public curriculum;
- semantic or generative answer grading;
- full coverage of advanced coordination chemistry;
- competitive scoring that treats client-recorded mastery as trusted evidence.
