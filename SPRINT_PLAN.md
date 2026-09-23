# Sprint Plan — Inorganic Chemistry Learning PWA

## 1. Delivery approach

The product will be delivered as an offline-first React application in one short inception sprint followed by six two-week delivery sprints. Each sprint must end with a usable, testable increment; content authoring and chemistry review run in parallel with development.

### Planning assumptions

- **Calendar:** 1-week Sprint 0, then six 2-week sprints (13 weeks total).
- **Team:** 2 frontend/full-stack developers, part-time UX designer, QA engineer, and a chemistry subject-matter expert (SME). If one person fills several roles, reduce the planned content volume rather than quality controls.
- **Architecture:** Next.js App Router + React + TypeScript + Tailwind CSS for the installable PWA; FastAPI + PostgreSQL for authenticated persistence and synchronization.
- **Storage:** versioned IndexedDB stores for curriculum, progress, attempts, sync queue, and spaced-repetition state; `localStorage` is limited to small non-sensitive preferences. Curriculum data is shipped as validated JSON/TypeScript assets.
- **Release target:** a Czech-language MVP that supports all four learning modes, works after the first online load, and is usable on desktop and mobile.

### MVP content target

The application mechanics and schema support the full curriculum, while the first release uses a reviewed content baseline:

- all 118 elements have identity, position, and category data for the periodic-table mode;
- the first 36 elements plus the most important industrial elements have reviewed occurrence and production content;
- at least 100 nomenclature questions, balanced across enabled categories and difficulties;
- at least 60 reviewed reaction questions, including coefficient and missing-part tasks;
- at least 30 reviewed mineral, production, and flashcard prompts.

Content volume is a release variable. Chemical correctness is not: unreviewed items must not be included merely to reach a count.

## 2. Product milestones

| Milestone | End of | Outcome |
|---|---:|---|
| Technical foundation | Sprint 1 | Installable offline shell, validated data, reusable exercise engine, local progress, API contract and persistence baseline |
| Internal alpha | Sprint 2 | Periodic-table learning mode complete end to end |
| Curriculum beta | Sprint 5 | All four learning modes available with reviewed baseline content |
| MVP release | Sprint 6 | Mastery views, accessibility, offline/recovery testing, release documentation |

## 3. Sprint-by-sprint plan

### Sprint 0 — Product definition and technical inception (1 week)

**Goal:** remove design and content ambiguity before feature development.

**Planned work**

- Confirm learner profile, curriculum level, supported browsers, and the boundary between MVP and later content expansion.
- Produce low-fidelity flows for home, mode setup, active question, answer feedback, result summary, and progress.
- Create the repository, quality gates, preview deployment, and production deployment pipeline.
- Define canonical schemas for elements, reactions, nomenclature, attempts, mastery, settings, and spaced-repetition cards.
- Define content ownership and a two-person review workflow: author plus chemistry SME approval.
- Create a content coverage matrix by topic, category, difficulty, and review status.
- Record architecture decisions for Next.js, FastAPI/SQLAlchemy, authentication, formula rendering, PWA caching, storage/synchronization versioning, and test tooling.

**Acceptance criteria**

- Critical user flows and navigation are agreed and visible in a clickable or low-fidelity prototype.
- A minimal application deploys to a preview URL through CI.
- Sample records for every entity pass runtime schema validation.
- The team agrees on the MVP content target and Definition of Done.

### Sprint 1 — Application foundation and shared exercise engine

**Goal:** establish the reusable platform needed by every learning mode.

**Planned work**

- Build the responsive application shell, navigation, mode cards, settings, and error boundary.
- Add the PWA manifest, service worker, install metadata, and an explicit offline state.
- Implement runtime validation for curriculum data, including unique IDs, atomic-number uniqueness, period/group bounds, and required localized fields.
- Implement a shared exercise-session state machine: setup, question, submitted answer, feedback, retry queue, summary, and restart.
- Store versioned attempts, settings, session summaries, mastery events, and pending sync events in IndexedDB; include safe defaults and recovery from invalid or old records.
- Establish the FastAPI service layers, PostgreSQL/Alembic baseline, stable OpenAPI operation IDs, and generated TypeScript client.
- Implement authenticated idempotent attempt-event synchronization according to the accepted authentication and persistence ADRs; local completion must never wait for synchronization.
- Create reusable formula display and input primitives. Keep a canonical plain-text value such as `H2SO4` and render a subscripted preview without changing the stored answer.
- Establish unit, component, end-to-end, accessibility, and data-validation test layers.

**Acceptance criteria**

- The application can be installed and reopened offline after one successful online load.
- A sample exercise can be completed, refreshed, and resumed without losing valid progress.
- Corrupt or unsupported local data produces a recoverable reset/migration path rather than a blank screen.
- Invalid curriculum data fails the build with a useful record identifier and error.
- Keyboard focus and screen-reader status messages work through the sample question and feedback flow.
- Repeating the same sync event does not create duplicate server records, and losing the network leaves it visibly queued for retry.

### Sprint 2 — Mode 1: blind periodic table

**Goal:** release the first complete learning mode and validate the common session engine.

**Planned work**

- Implement the 18 × 7 table plus separate lanthanide and actinide rows from data rather than hard-coded labels.
- Add scope filters: first 36, all 118, selected groups, d-block, metals, nonmetals, and metalloids.
- Implement both task directions: prompt-to-position and position-to-symbol/name, including four-choice answers where configured.
- Add immediate correct/incorrect feedback and an error queue repeated at the end of the session.
- Implement keyboard navigation and sufficiently large touch targets.
- On narrow screens, provide a clearly discoverable horizontal-scroll layout and preserve readable cell sizes.
- Record per-element attempts in the mastery event model created in Sprint 1.

**Acceptance criteria**

- All 118 elements render in their correct positions and every filter produces only eligible questions.
- The two exercise directions can each complete a session and generate an accurate summary.
- Incorrect elements reappear once in the end-of-session retry round without creating an infinite loop.
- The table is usable at 360 px width and at desktop width using touch, mouse, and keyboard.
- Chemistry SME approves the identity, symbol, group, period, and category dataset.

#### Sprint 2 follow-up — Plynulé procvičování pozic (2026-09-22)

**Stav (2026-09-23):** PT-UX-1 až PT-UX-4 jsou implementovány v `apps/web/components/periodic-table-name-practice.tsx` se sdílenou mřížkou `periodic-table-grid.tsx`, výběrem rozsahu `apps/web/lib/periodic-table-scope.ts` a vyhodnocením `evaluateElementAnswer` v `packages/chemistry`. Směr název → pozice (slepá tabulka) byl 2026-09-23 na žádost vlastníka přepracován na plynulé cvičení celé tabulky v náhodném pořadí se živým skóre a stopkami; popis je v `docs/product-spec.md`. Obnovení rozpracované série po reloadu (oddíl „Offline, kompatibilita“) zatím chybí. Prioritní doplnění Sprintu 2 na základě uživatelské zpětné vazby k `/procvicovani/periodicka-tabulka/nazvy`; musí být dokončeno před označením tohoto režimu za hotový.

**Cíl:** umožnit rychlé procvičování na jedné stabilní obrazovce, se zachováním již určených prvků, volbou skupin a odpovědí českým názvem nebo chemickou značkou.

**Zjištěný výchozí stav**

- `apps/web/components/periodic-table-practice.tsx` při stavu `feedback` vrací samostatný panel místo tabulky. Nejde o přesměrování na jinou URL, ale výměna celého obsahu působí jako odchod na jinou stránku.
- Buňky vykreslují pouze `?` nebo značku aktuální pozice `●`; chybí stav vyřešených prvků a zobrazení jejich chemických značek.
- `advance()` přepne otázku, ale nevymaže `answer`, takže řízený vstup zachová předchozí odpověď.
- `start()` používá `elements.slice(0, 10)` bez nastavení skupin. Vyhodnocení přijímá pouze český název s existující tolerancí diakritiky.
- Toto doplnění rozšiřuje původní minimální rozsah v [aktivním plánu periodické tabulky](docs/exec-plans/active/periodic-table-practice.md), který filtry výslovně odkládal. Pro následující implementaci platí rozsah níže; původní plán zůstává záznamem předchozího přírůstku. Architektura ani přijatá ADR se nemění.

**PT-UX-1 — Stálá tabulka a vyhodnocení na místě (P1; požadavky 1 a 2)**

- Zachovat jednu tabulku během otázky, zpětné vazby i přechodu na další prvek. Výsledek zobrazit přímo vedle formuláře pod tabulkou, bez navigace a bez odmontování mřížky.
- Po správné odpovědi trvale zobrazit v příslušné buňce kanonickou chemickou značku z ověřených dat. Evidovat vyřešené prvky podle stabilního ID odděleně od zvýraznění aktuální otázky; značky zůstanou viditelné až do restartu včetně závěrečného souhrnu.
- Po chybě zobrazit správný název a značku v místní zpětné vazbě, ale prvek neoznačit za vyřešený. Při pokračování skrýt tuto nápovědu. V opakovacím kole nesmí být odpověď na aktuální otázku prozrazena v buňce ani v jejím přístupném názvu.
- Zachovat jeden opakovací pokus pro každou původně chybnou odpověď a oddělené výsledky prvního průchodu a opakování. Ani druhá chyba nesmí vyvolat nekonečné opakování.
- Rozlišit aktuální, vyřešenou a chybnou pozici textem nebo ikonou vedle barvy. Oznámit výsledek krátkým `aria-live` stavem, nikoli opětovným čtením celé tabulky.

**Akceptace:** po dvou správných odpovědích zůstávají obě značky na správných místech při třetí otázce i v souhrnu; chyba není označena jako vyřešená. URL se nemění, tabulka nezmizí a její vodorovné posunutí se zachová. Je-li další pozice mimo výřez, posunout pouze kontejner tabulky nezbytně pro její zobrazení; stránka neskáče na začátek.

**PT-UX-2 — Prázdný vstup a plynulé ovládání klávesnicí (P1; požadavek 3)**

- Při přechodu na každou další otázku, vstupu do opakování a restartu vymazat odpověď i předchozí zpětnou vazbu a zaměřit vstup. Odeslanou odpověď lze ponechat pouze ve zpětné vazbě aktuální otázky.
- Enter ve vstupu vyhodnotí neprázdnou odpověď. Ve zpětné vazbě nabídnout tlačítko „Další prvek“ ovladatelné Enterem; po přechodu vrátit fokus do vstupu. Nezavádět automatický časovaný přechod.
- Prázdný nebo pouze mezerový vstup nepočítat jako chybný pokus. Každou otázku vyhodnotit a uložit nejvýše jednou; ošetřit dvojklik, opakovaný Enter i drženou klávesu proti dvojímu odeslání nebo přeskočení otázky.
- Místní uložení pokusu nesmí blokovat zobrazení výsledku. Při selhání úložiště ponechat srozumitelné upozornění a umožnit pokračovat bez předstírání úspěšného uložení.

**Akceptace:** správná i chybná odpověď vedou po pokračování k prázdnému zaměřenému vstupu; totéž platí v opakovacím kole. Celé cvičení lze dokončit klávesnicí, bez duplicitních pokusů a bez nechtěného odeslání předchozí hodnoty.

**PT-UX-3 — Výběr procvičovaných skupin (P1; požadavek 4)**

- Před spuštěním nabídnout vícenásobný výběr skupin 1–18, ovládání „Vybrat vše“ / „Zrušit výběr“, počet dostupných prvků a samostatné volby pro dvě spodní řady. Číslované skupiny odlišit od pojmenovaných chemických kategorií; schválené názvy skupin čerpat pouze z obsahu.
- Členství určit z ověřených polí `group` a z existujícího adaptéru rozložení, nikoli z ručně opsaných seznamů. Respektovat [ADR skupiny 3](docs/decisions/group-3-membership.md): Sc, Y, Lu a Lr patří do skupiny 3; spodní řady obsahují záznamy s `group: null`. Volby spodních řad pojmenovat tak, aby bylo jejich vymezení v tomto rozložení zřejmé.
- Množinu otázek vytvořit jako sjednocení vybraných skupin/řad bez duplicit. Ponechat viditelnou celou tabulku pro orientaci, ale otázky i opakování vybírat pouze z vybraného rozsahu.
- Odstranit pevný výběr prvních deseti prvků. Výchozí rozsah je celá tabulka, délka série `min(10, počet vybraných prvků)`; před každou novou sérií promíchat celý filtrovaný seznam bez opakování a až potom uplatnit limit. Generátor náhody musí být injektovatelný pro deterministické testy.
- Při prázdném výběru nespouštět cvičení a vysvětlit proč. Tlačítko spuštění i průběh zobrazují skutečný počet otázek, včetně výběru jediného prvku.
- Nastavení uzamknout po dobu série; jeho změnu nabídnout po dokončení nebo přes výslovné ukončení rozehrané série. Změna nesmí potichu přepsat otázky ani smíchat výsledky různých rozsahů.

**Akceptace:** kombinace například skupin 1 a 17 nabídne pouze jejich prvky, výběr skupiny 3 odpovídá ADR, spodní řady nezpůsobí duplicity a menší množina se dokončí se správným počtem otázek. Opakované série nejsou trvale omezené na prvních deset prvků filtrovaného seznamu.

**PT-UX-4 — Odpověď názvem nebo značkou (P1; požadavek 5)**

- Na stávající URL přijímat v jednom vstupu buď český název, nebo chemickou značku očekávaného prvku. Výchozí popisek změnit na „Český název nebo značka“ a sjednotit nadpis, zadání i nápovědu, aby funkce nevyžadovala hledání jiné stránky nebo přepínání před každou odpovědí.
- Vyhodnocení umístit do čisté funkce v `packages/chemistry`: názvy používají existující normalizaci a toleranci chybějící diakritiky, značky přesně odpovídají kanonickému zápisu po odstranění krajních mezer. Neopravovat velikost písmen značek a nepoužívat fuzzy porovnávání ani libovolné aliasy.
- Pozitivní fixture pro sodík: `sodík`, `sodik`, `Na`, ` Na `. Negativní fixture pro tutéž otázku: `na`, `NA`, `N`, jiný název, překlep a vzorec sloučeniny. Chybu velikosti písmen lze vysvětlit, ale nesmí být vyhodnocena jako správná odpověď.
- Ve zpětné vazbě vždy ukázat ověřený název i kanonickou značku. Do lokálního pokusu zaznamenat pravdivý kontext směru a kombinované politiky vyhodnocení; nový režim nesmí být označen jen jako historické `position-to-name` / `diacritics-tolerant`.

**Akceptace:** v jedné sérii lze střídavě odpovídat názvy a značkami bez změny nastavení. Správné varianty projdou, jiné prvky a nesprávně psané značky neprojdou; uložený kontext umožní odlišit nové pokusy od starého režimu.

**Pořadí implementace a dotčené oblasti**

1. PT-UX-1 + PT-UX-2: stabilní rozvržení a stav vyřešených buněk v `apps/web/components/periodic-table-practice.tsx`, přechody v `apps/web/lib/exercise-session.ts` pouze podle potřeby. Zachovat chování druhého směru procvičování a jeho regresní testy.
2. PT-UX-3: čistá deterministicky testovatelná selekce otázek, nastavení série a využití `apps/web/lib/periodic-table-layout.ts`; bez nových závislostí a bez změn chemických zdrojových dat.
3. PT-UX-4: doménový vyhodnocovač, integrace formuláře a textů v `apps/web/app/procvicovani/periodicka-tabulka/nazvy/page.tsx`, rozšíření a runtime validace kontextu v `apps/web/lib/browser-progress-store.ts`.
4. Sjednotit popis chování v `docs/product-spec.md`, případné změny uloženého formátu v `docs/architecture.md` a přesnou politiku značek v `docs/chemistry-content.md`. Doplnit níže uvedené testy a dokončit kvalitativní bránu.

**Offline, kompatibilita a hranice rozsahu**

- Výběr, vyhodnocení, zpětná vazba i opakování fungují lokálně bez API. Průběh série zahrnuje nastavení, aktuální otázku, frontu chyb a vyřešená ID; při obnovení nesmí vzniknout další pokus ani únik správné odpovědi. Po restartu série se vyřešené buňky vyčistí, historické pokusy zůstanou zachované.
- Před zavedením uloženého stavu série prověřit současnou implementaci úložiště proti požadavku obnovení po reloadu. Chybějící obnovení doplnit v rámci tohoto přírůstku jako verzovaný IndexedDB záznam podle ADR 0003, ne jako nevalidovaný obsah `localStorage`. Pro změny schématu přidat testovanou migraci a bezpečnou obnovu poškozené série bez smazání historie pokusů.
- Staré pokusy ponechat čitelné a beze změny jejich významu; nové kombinace směru/politiky ověřovat na runtime hranici. Při změně API schématu postupovat přes FastAPI OpenAPI a generované kontrakty, nevytvářet ruční kopie DTO. Návrat na starší klient nesmí tiše zahazovat nové záznamy; popsat podporovaný postup obnovy.
- Tento přírůstek nevyžaduje nové chemické údaje. Případné nové názvy skupin či aliasy podléhají validaci a SME review. Ostatní filtry Sprintu 2 (prvních 36, kategorie kovů apod.) zůstávají samostatnými již naplánovanými položkami.

**Ověření a dokončení přírůstku**

- Unit testy: sjednocení a prázdný výběr skupin, skupina 3 a spodní řady, výběr bez duplicit se seedem, limity série, pozitivní i negativní názvy/značky, přesně jedno opakování chyb.
- Komponentové testy: vyřešené značky přetrvají, tabulka zůstává během výsledku, vstup se čistí a správně získává fokus, ochrana před dvojím odesláním, žádná prozrazená odpověď při opakování, chyba místního ukládání a izolace nastavení série.
- Playwright: kompletní správná série se smíšenými názvy/značkami; kompletní chybná série s jedním opakováním; výběr více skupin; prázdný/jednoprvkový rozsah; neměnná URL; zachované značky a posunutí tabulky; klávesnice; rozložení 360 px; offline dokončení a obnovení rozpracované série po reloadu; regrese směru název → pozice.
- Migrace/kompatibilita: staré pokusy se načtou beze změny, nová série a kontext odpovědi projdou validací, poškozený stav nabídne bezpečnou obnovu. Ručně ověřit čtečku obrazovky, fokus a dotykové ovládání.
- Před dokončením implementace spustit celou bránu z [docs/testing.md](docs/testing.md): `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm content:validate`, `pnpm contracts:check`, `uv --directory apps/api run ruff format --check .`, `uv --directory apps/api run ruff check .`, `uv --directory apps/api run pytest -q`, `pnpm build`, `pnpm test:e2e`. Zapsat skutečné výsledky a případné blokace; plánování samo o sobě nesplňuje akceptaci implementace.

### Sprint 3 — Mode 3: inorganic nomenclature

**Goal:** support fast Czech formula/name practice without input friction.

**Planned work**

- Add multi-select filters for oxides, hydroxides, binary acids and salts, oxoacids, oxoacid salts, hydrogensalts, and hydrates.
- Implement formula-to-name and name-to-formula sessions.
- Normalize case, surrounding/repeated whitespace, Unicode composition, formula spacing, and equivalent dot notation for hydrates.
- Implement two answer policies: strict and tolerant. Tolerant mode may ignore missing diacritics and explicitly approved aliases; it must not silently accept chemically different terms.
- Show the normalized rendered formula as the learner types while retaining an editable plain-text input.
- Include difficulty in selection and results so content coverage can be assessed.

**Acceptance criteria**

- Any valid combination of selected categories produces only questions from those categories; an empty selection is handled clearly.
- Both task directions accept documented equivalent formatting and reject chemically different answers.
- Strict/tolerant behavior is covered by a chemistry-SME-approved table of positive and negative examples.
- At least 100 reviewed questions are available with no duplicate logical prompt/answer pair.
- A learner can complete the mode using only the keyboard.

### Sprint 4 — Mode 2: chemical equations and balancing

**Goal:** deliver reliable equation practice with explanatory atom-balance feedback.

**Planned work**

- Add filters by element and reaction category: production, characteristic, redox, and industrial.
- Implement coefficient inputs with a single normalization rule: blank coefficient and explicit `1` both mean one.
- Validate atom conservation independently from the stored expected coefficients and require the lowest whole-number ratio.
- Implement missing-reactant/product questions using text input and optional four-choice presentation.
- Add formula/equation rendering and an atom-balance table that compares each element on both sides after an incorrect answer or when help is requested.
- Add automated data checks that parse supported formulas and reject stored equations that are not balanced.

**Acceptance criteria**

- Correct lowest-ratio coefficient sets pass; zero, negative, decimal, incomplete, unbalanced, and proportionally inflated sets fail with appropriate feedback.
- Blank-versus-`1` behavior is consistent across keyboard entry, validation, results, and retry.
- The atom-balance aid reports correct left/right counts for every element in the supported test corpus.
- Missing-part answers use canonical normalization and accept only reviewed equivalent forms.
- At least 60 reaction questions pass automated balance checks and chemistry review.

### Sprint 5 — Mode 4: occurrence, production, and flashcards

**Goal:** complete curriculum coverage and introduce deliberate review over time.

**Planned work**

- Add filters by element and logical topic, including iron/steel, halogens, sulfuric acid, and nitric acid.
- Implement mineral-to-element matching, production-principle questions, and industrial condition prompts.
- Implement two-sided element flashcards with occurrence, important ores, laboratory preparation where applicable, industrial production, and equations.
- Add “Knew it / Didn’t know it” grading and a simple documented spaced-repetition schedule.
- Persist due dates and review history locally and show due-card counts without requiring an account.
- Run a complete chemistry review of high-risk industrial conditions, catalysts, temperatures, pressures, and equations.

**Acceptance criteria**

- Each question links back to a reviewed source record and displays only content relevant to the selected scope.
- Flashcard grades update the next due date deterministically; overdue cards are prioritized and survive restart/offline use.
- Changing the device clock or encountering a malformed due date does not corrupt the deck.
- The reviewed baseline contains at least 30 prompts/cards and covers every advertised MVP topic.
- All four learning modes are reachable and completeable in the offline production build.

### Sprint 6 — Mastery, quality hardening, and MVP release

**Goal:** turn the feature-complete beta into a trustworthy, releasable learning product.

**Planned work**

- Add the periodic-table mastery heatmap and per-mode summaries based on stored attempts.
- Define mastery using a minimum-attempt threshold and recent-answer weighting so one correct answer does not display as full mastery.
- Add a transparent legend, a no-data state distinct from poor mastery, and a non-color cue for every heatmap level.
- Add progress reset and local data export/import for recovery and transfer between browsers if capacity permits; reset is mandatory, export/import is the first descoping candidate.
- Verify authenticated synchronization across offline/online transitions, duplicate retries, expired sessions, and a second device.
- Complete accessibility, responsive, performance, install/update, cache-version, and storage-migration testing.
- Conduct moderated usability sessions with representative learners and fix release-blocking findings.
- Finalize learner help, privacy statement, content credits/sources, known limitations, and release runbook.

**Acceptance criteria**

- Heatmap calculations match known attempt fixtures and distinguish no data, low mastery, and high mastery without relying on color alone.
- Progress reset requires confirmation and removes only application-owned records.
- Core flows meet WCAG 2.2 AA checks for keyboard access, focus visibility, labels, status announcements, and contrast.
- The production build works offline after first load on the agreed desktop and mobile browser matrix.
- No open severity-1/2 defects; all shipped curriculum records have SME approval; release checklist is signed off by product, QA, and chemistry SME.

## 4. Cross-sprint workstreams

### Content pipeline

Content work starts in Sprint 0 and is reviewed at least one sprint before the feature that consumes it. Every record carries an authoring/review status outside the shipped runtime payload. Automated checks cover schema correctness, duplicate IDs, element placement, formula parseability, and equation balance; the SME remains responsible for scientific meaning and Czech terminology.

### Testing strategy

- **Unit tests:** normalization, coefficient reduction, formula parsing, atom counts, question selection, mastery, and spaced repetition.
- **Component tests:** inputs, feedback states, filters, table cells, cards, and keyboard behavior.
- **End-to-end tests:** one complete happy path and one error/retry path for every mode, offline launch, storage migration, and progress reset.
- **Content tests:** schema, uniqueness, referential integrity, coverage thresholds, parseability, and balanced equations.
- **Manual tests:** chemistry review, assistive technology, small-screen usability, PWA install/update, and cross-browser behavior.

### Definition of Done for every story

A story is done only when its acceptance criteria are met, automated tests pass, responsive and keyboard behavior are checked, user-facing Czech text is reviewed, relevant curriculum data has SME approval, analytics/mastery events are recorded where applicable, and documentation is updated. Work hidden behind a temporary flag may merge, but it does not count as a delivered sprint outcome.

## 5. Dependencies and critical path

1. Final schemas and content workflow are prerequisites for reliable feature work.
2. The shared exercise engine, formula primitives, persistence, and event model must land before individual modes.
3. Reviewed content must be ready before the relevant mode enters its sprint; chemistry review is therefore on the critical path.
4. Attempt events must be captured consistently from Sprint 2 onward so Sprint 6 mastery is based on real data.
5. Offline and storage migrations must be tested continuously; postponing them to release would put all user progress at risk.

## 6. Principal risks and mitigations

| Risk | Impact | Mitigation / trigger |
|---|---|---|
| Chemistry content is late or incorrect | Blocks release or teaches wrong material | Coverage matrix, SME review gate, automated equation/data checks; reduce volume before reducing review quality |
| Fuzzy matching accepts a wrong answer | Damages trust and learning | Whitelisted aliases, explicit positive/negative fixtures, strict mode, conservative tolerance |
| Periodic table is unusable on phones | Mode 1 fails a core audience | Validate the scroll interaction in Sprint 2 on real narrow devices; consider zoom only after usability evidence |
| PWA cache serves stale code/content | Learners see inconsistent versions | Version caches and stored data, test updates from each supported prior version, provide recovery UI |
| Browser storage is cleared, evicted, or reaches limits | Progress loss | Quota handling, authenticated idempotent sync, reset/recovery; add export/import if capacity remains |
| Four modes dilute quality | Schedule overrun | Keep the shared engine small, ship modes sequentially, enforce content thresholds and explicit descoping order |

## 7. Scope control

If capacity is lower than planned, descope in this order while preserving a coherent MVP:

1. Progress export/import.
2. Optional multiple-choice variants where a text-entry version already exists.
3. Advanced mastery trend charts beyond the required heatmap and summaries.
4. Content volume above the reviewed minimums.

Do not descope data validation, chemistry review, accessible feedback, local progress recovery, offline behavior, or the core task type of any advertised learning mode.

## 8. Post-MVP backlog

- Expanded reviewed content for all elements and advanced industrial chemistry.
- Expanded account features beyond the MVP progress-sync boundary, designed without placing credentials in browser persistence.
- Teacher-created question sets, class assignments, and progress export.
- More adaptive scheduling and difficulty selection based on observed mastery.
- Localization beyond Czech.
- Rich worked solutions and reaction-mechanism explanations.
- Anonymous product analytics only after consent, data minimization, and a clear privacy decision.

## 9. Delivery status (audited 2026-09-21, HEAD 4571e98)

### Sprint 1 — Application foundation and shared exercise engine (IN PROGRESS)

- [x] Shared exercise-session state machine with one bounded retry round
- [x] Runtime curriculum validation for element/group IDs, symbols, and atomic numbers
- [x] Versioned IndexedDB attempt-event and element-card stores
- [x] PWA manifest, service worker, offline reopen of the application shell
- [ ] Responsive shell — settings screen and error boundary outstanding
- [ ] Recoverable reset/migration path for corrupt or unsupported local data (BUG-004)
- [ ] Formula display and input primitives
- [ ] FastAPI persistence baseline beyond `GET /api/v1/health`; no Alembic revision exists
- [ ] Authenticated idempotent attempt-event synchronization
- [ ] Accessible focus management (blocked by BUG-001)

### Sprint 2 — Mode 1: blind periodic table (BLOCKED)

Cannot start until BLOCK-001 is resolved. Resolve BUG-006 before this sprint records
any real attempt data; critical-path item 4 makes the attempt model a prerequisite,
not a follow-up.

### Sprint 3 — Mode 3: inorganic nomenclature (NOT STARTED)

`docs/exec-plans/active/nomenclature-foundation.md` is written. No reviewed records exist.
The diacritics behavior shipped in 4571e98 contradicts that plan and must be reconciled
before nomenclature content lands (BUG-002).

## 10. Blockers and defect backlog

| ID | Sev | Title | Detail |
|---|---|---|---|
| BLOCK-001 | 1 | Group-3 membership makes the periodic grid ambiguous | `content/data/elements.json` assigns La, Lu, Ac and Lr all to group 3, so cells (period 6, group 3) and (period 7, group 3) hold two elements each; 92 elements with a group occupy 90 distinct cells. Needs a documented membership decision recorded as an ADR (IUPAC 2021 provisional recommends Sc, Y, Lu, Lr; many Czech textbooks still print La/Ac — the dispute is live and must be decided explicitly, not inherited), plus a `duplicate_position` validator in `content/src/validation.ts`. Sprint 2 AC "all 118 elements render in their correct positions" is unreachable until then. |
| BUG-001 | 2 | `pnpm lint` fails on main | `apps/web/components/element-name-practice.tsx`: `a11y/noAutofocus` at :115 and :140; `complexity/useOptionalChain` at :37 and :64. CI job `quality` is red; `main` is not releasable. |
| BUG-002 | 2 | Answer policy is unconditional and lives in a React component | `element-name-practice.tsx:38-45` decides tolerance inline with no strict/tolerant switch. Violates the AGENTS.md prohibition on chemistry validation inside React components and the `packages/chemistry` ownership of answer normalization and nomenclature rules. |
| BUG-003 | 2 | Error notices are unreachable | `notice` renders only in the active-question form. The empty-session message (:27) and the IndexedDB write-failure message (:56) are never visible to the learner. |
| BUG-004 | 2 | IndexedDB open has no blocked/version-error path | `apps/web/lib/browser-learning-database.ts:6` — no `onblocked` handler, so a blocked upgrade leaves the promise unsettled; no `VersionError` recovery for a downgraded client. |
| BUG-005 | 3 | `contentVersion` hardcoded in the UI | `element-name-practice.tsx:51` writes the literal `"elements-2026-09-19"`. `content/src/runtime.ts` must export a generated content version and the UI must consume it. |
| BUG-006 | 3 | Attempt model cannot support Sprint 6 mastery | `AttemptEvent` lacks `round`, `mode`, `direction` and `matchPolicy`, and is validated by a hand-rolled type guard rather than Zod. Fix before Sprint 2 records real data. |
| BUG-007 | 3 | Import statement placed after the component body | `apps/web/app/page.tsx:83`. Enable `assist.actions.source.organizeImports` in `biome.json`. |
| BUG-008 | 3 | Test-layer gaps | No component tests for `ElementNamePractice` or `ElementFlashcards`; no incorrect-answer/retry E2E for any mode (AGENTS.md requires one per mode); `page.test.tsx` not updated for the 4571e98 copy change. |
| BUG-009 | 3 | Element content review provenance is not SME-grade | All 118 records cite `reviewedBy: "Project curriculum approval"` against a conversation locator. Sprint 2 AC requires named chemistry-SME approval of identity, symbol, group, period and category. |
| BUG-010 | 3 | Sprint 5 scope built early without tests | `apps/web/components/element-flashcards.tsx` (413 lines) implements local card override/custom/reset ahead of its sprint, with no component test. |
| BUG-011 | 4 | Content inconsistencies pending SME adjudication | `Lr.valenceConfiguration` omits `5f14` while `Lu` includes `4f14`; `Lr.nameLat` is `Laurentium` rather than `Lawrencium`. |
| BUG-012 | 4 | Production build dirties tracked `next-env.d.ts` | `pnpm build` rewrites `.next/dev/types/…` to `.next/types/…`. Regenerate and commit, or untrack. |

### Resolution status (2026-09-22)

All items above are resolved on `main` except the group part of BUG-009.

| ID | Status | Resolved by |
|---|---|---|
| BLOCK-001 | Resolved | #2: ADR `docs/decisions/group-3-membership.md` and the `duplicate_position` validator |
| BUG-001 | Resolved | #1 |
| BUG-002 | Resolved | #8, #9: `evaluateAnswer` in `packages/chemistry`, used by both practice components |
| BUG-003 | Resolved | #1 |
| BUG-004 | Resolved | #1 |
| BUG-005 | Resolved | #1: `curriculumContentVersion` from `content/src/runtime.ts` |
| BUG-006 | Resolved | #3 (attempt context fields), #10 (Zod schema) |
| BUG-007 | Resolved | #1 |
| BUG-008 | Resolved | #1, #9, #10: component tests, plus retry-path tests for element-name practice and both periodic-table directions |
| BUG-009 | Partly resolved | #11 added the reviewer registry, review fingerprints and `pnpm content:release-check`. All 118 elements were reviewed by the chemistry SME `reviewer.vvojtisek` on 2026-09-22. The 8 named groups (names and mnemonics) still need an SME review, and `pnpm content:release-check` blocks on them. |
| BUG-010 | Resolved | #9: `element-flashcards.test.tsx` |
| BUG-011 | Resolved | SME decision 2026-09-22: Lr valence configuration is `5f14 7s2 7p1`; Czech `Lawrencium` and Latin `Laurentium` are confirmed as intended |
| BUG-012 | Resolved | #10: `next-env.d.ts` is untracked and generated by `next typegen` |
| BUG-013 | Resolved | #9: the flashcard group mnemonic removed in #8 was restored (found in the 2026-09-22 audit) |

The same SME review also corrected the beryllium Czech name from `Berylium` to `Beryllium`, identical to the Latin name.
