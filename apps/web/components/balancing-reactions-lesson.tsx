"use client";

import {
  BALANCING_REACTION_CATEGORIES,
  BALANCING_REACTION_CATEGORY_LABELS,
  type BalancingReactionRuntimeLesson,
  type BalancingReactionRuntimeSpecies,
} from "@inorganic/content/balancing-reactions";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { ChemicalText } from "@/components/chemical-text";
import { Formula } from "@/components/formula";
import {
  loadBalancingSelection,
  loadCompletedBalancingLessons,
  saveBalancingSelection,
  saveCompletedBalancingLessons,
} from "@/lib/balancing-preferences";
import { cn } from "@/lib/class-names";
import { czechCount } from "@/lib/czech-plural";
import { getElementColor } from "@/lib/element-display-colors";
import styles from "./balancing-reactions-lesson.module.css";

function speciesKey(species: BalancingReactionRuntimeSpecies): string {
  if (species.charge === 0) return species.formula;
  const magnitude = Math.abs(species.charge);
  return `${species.formula}^${magnitude === 1 ? "" : magnitude}${species.charge > 0 ? "+" : "-"}`;
}

function describeEquation(
  reactants: readonly BalancingReactionRuntimeSpecies[],
  products: readonly BalancingReactionRuntimeSpecies[],
): string {
  const side = (species: readonly BalancingReactionRuntimeSpecies[]) =>
    species
      .map((term) => `${term.coefficient === 1 ? "" : `${term.coefficient} `}${speciesKey(term)}`)
      .join(" + ");
  return `${side(reactants)} -> ${side(products)}`;
}

function ReactionTerm({
  term,
  focused,
  coefficientState,
  finalized,
  variable,
}: Readonly<{
  term: BalancingReactionRuntimeSpecies;
  focused: boolean;
  coefficientState: "unresolved" | "active" | "resolved";
  finalized: boolean;
  variable: string | undefined;
}>) {
  return (
    <span
      className={cn(styles.reactionTerm, focused && styles.reactionTermActive)}
      data-active={focused || coefficientState === "active" ? "true" : undefined}
    >
      <span
        className={cn(
          styles.reactionCoefficient,
          (coefficientState === "active" || finalized) && styles.coefficientFilled,
          coefficientState === "resolved" && !finalized && styles.coefficientResolved,
        )}
        data-coefficient={term.coefficient}
        data-coefficient-state={coefficientState}
        data-coefficient-final={finalized ? "true" : undefined}
      >
        {term.coefficient}
      </span>
      {variable ? <small className={styles.coefficientVariable}>{variable}</small> : null}
      <Formula charge={term.charge} formula={term.formula} colorElements />
    </span>
  );
}

function ReactionEquation({
  current,
  history,
  focusedSpecies,
  coefficientChanges,
  isSummary,
  showVariables,
}: Readonly<{
  current: BalancingReactionRuntimeLesson["steps"][number]["equation"];
  history: readonly BalancingReactionRuntimeLesson["steps"][number][];
  focusedSpecies: readonly string[];
  coefficientChanges: readonly string[] | undefined;
  isSummary: boolean;
  showVariables: boolean;
}>) {
  const state = (
    term: BalancingReactionRuntimeSpecies,
    side: "reactant" | "product",
  ): "unresolved" | "active" | "resolved" => {
    if (isSummary) return "resolved";
    const previous = history.at(-1)?.equation;
    const previousTerms = side === "reactant" ? previous?.reactants : previous?.products;
    const previousTerm = previousTerms?.find(
      (candidate) => candidate.formula === term.formula && candidate.charge === term.charge,
    );
    const active = coefficientChanges
      ? coefficientChanges.includes(speciesKey(term))
      : previousTerm
        ? previousTerm.coefficient !== term.coefficient
        : term.coefficient !== 1;
    if (active) return "active";
    const determined = history.some(
      (frame) =>
        frame.coefficientChanges?.includes(speciesKey(term)) ||
        (side === "reactant" ? frame.equation.reactants : frame.equation.products).some(
          (candidate) => speciesKey(candidate) === speciesKey(term) && candidate.coefficient !== 1,
        ),
    );
    return determined || term.coefficient !== 1 ? "resolved" : "unresolved";
  };

  return (
    <div
      aria-label={describeEquation(current.reactants, current.products)}
      className={styles.equationFrame}
      role="img"
    >
      <div className={styles.equation}>
        {current.reactants.map((term, index) => (
          <span key={`${term.formula}-${term.charge}`}>
            {index > 0 ? <span className={styles.equationOperator}>+</span> : null}
            <ReactionTerm
              coefficientState={state(term, "reactant")}
              finalized={isSummary}
              focused={focusedSpecies.includes(speciesKey(term))}
              term={term}
              variable={showVariables ? `c${index + 1}` : undefined}
            />
          </span>
        ))}
        <span className={styles.equationOperator}>→</span>
        {current.products.map((term, index) => (
          <span key={`${term.formula}-${term.charge}`}>
            {index > 0 ? <span className={styles.equationOperator}>+</span> : null}
            <ReactionTerm
              coefficientState={state(term, "product")}
              finalized={isSummary}
              focused={focusedSpecies.includes(speciesKey(term))}
              term={term}
              variable={showVariables ? `c${current.reactants.length + index + 1}` : undefined}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function BalanceCards({
  step,
}: Readonly<{ step: BalancingReactionRuntimeLesson["steps"][number] }>) {
  const ledger = step.balanceLedger;
  const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
  const entries = [
    ...(ledger?.atoms ?? []).map((atom) => ({
      label: atom.element,
      left: atom.reactants,
      right: atom.products,
      charge: false,
    })),
    ...(ledger?.charge
      ? [
          {
            label: "Náboj",
            left: ledger.charge.reactants,
            right: ledger.charge.products,
            charge: true,
          },
        ]
      : []),
  ];
  return (
    <>
      <ul aria-label="Kontrolní bilance" className={styles.balanceCards}>
        {entries.map((entry) => {
          const balanced = entry.left === entry.right;
          return (
            <li
              key={entry.label}
              aria-label={entry.label}
              className={cn(styles.balanceCard, balanced ? styles.statusGood : styles.statusBad)}
            >
              <span
                className={styles.elementSymbol}
                data-element={entry.charge ? undefined : entry.label}
                style={entry.charge ? undefined : { color: getElementColor(entry.label) }}
              >
                {entry.label}
              </span>
              <span className={styles.countRelation}>
                {entry.charge ? signed(entry.left) : entry.left}
                {balanced ? " = " : " vs "}
                {entry.charge ? signed(entry.right) : entry.right}
              </span>
              <span className={styles.status}>{balanced ? "✓ Vyčísleno" : "≠ Nevyčísleno"}</span>
            </li>
          );
        })}
      </ul>
      <div className={styles.electronChecks}>
        {(step.notes ?? []).map((note) => (
          <span key={note.label}>
            <strong>{note.label}:</strong> <ChemicalText text={note.value} />
          </span>
        ))}
        {(ledger?.redoxPairs ?? []).map((pair) => (
          <span key={pair.species}>
            {pair.species}: {signed(pair.fromOx)} → {signed(pair.toOx)}
            {" · "}
            {pair.deltaE > 0 ? "přijímá" : "odevzdává"} {Math.abs(pair.deltaE)} e⁻
          </span>
        ))}
      </div>
    </>
  );
}

type BalancingCategory = (typeof BALANCING_REACTION_CATEGORIES)[number];

function shuffled(ids: readonly string[]): string[] {
  const result = [...ids];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap] as string, result[index] as string];
  }
  return result;
}

function EquationPicker({
  lessons,
  category,
  selectedIds,
  completedIds,
  shuffle,
  headingRef,
  onCategoryChange,
  onToggleLesson,
  onToggleCategory,
  onClear,
  onShuffleChange,
  onStart,
}: Readonly<{
  lessons: readonly BalancingReactionRuntimeLesson[];
  category: BalancingCategory;
  selectedIds: ReadonlySet<string>;
  completedIds: ReadonlySet<string>;
  shuffle: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onCategoryChange: (category: BalancingCategory) => void;
  onToggleLesson: (lessonId: string) => void;
  onToggleCategory: () => void;
  onClear: () => void;
  onShuffleChange: (shuffle: boolean) => void;
  onStart: () => void;
}>) {
  const categoryLessons = lessons.filter((lesson) => lesson.category === category);
  const allSelected =
    categoryLessons.length > 0 && categoryLessons.every((lesson) => selectedIds.has(lesson.id));
  return (
    <div className={styles.picker}>
      <header className={styles.pickerHeader}>
        <h2 className={styles.pickerTitle} ref={headingRef} tabIndex={-1}>
          Vyberte rovnice k procvičení
        </h2>
        <p className={styles.pickerHint}>Rovnice z různých kategorií lze kombinovat.</p>
      </header>
      <nav aria-label="Kategorie reakcí" className={styles.categoryNav}>
        <div className={styles.categoryList}>
          {BALANCING_REACTION_CATEGORIES.map((option) => {
            const optionLessons = lessons.filter((candidate) => candidate.category === option);
            const selectedCount = optionLessons.filter((lesson) =>
              selectedIds.has(lesson.id),
            ).length;
            return (
              <button
                aria-pressed={category === option}
                className={cn(
                  styles.categoryButton,
                  category === option && styles.categoryButtonActive,
                )}
                key={option}
                onClick={() => onCategoryChange(option)}
                type="button"
              >
                <span className={styles.categoryNumber}>{option}.</span>{" "}
                {BALANCING_REACTION_CATEGORY_LABELS[option]}{" "}
                <span className={styles.categoryCount}>({optionLessons.length})</span>
                {selectedCount > 0 ? (
                  <span className={styles.categorySelected}> vybráno {selectedCount}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
      {categoryLessons.length === 0 ? (
        <p className={styles.emptyState} role="status">
          Tato kategorie zatím nemá připravenou interaktivní lekci.
        </p>
      ) : (
        <fieldset className={styles.lessonPicker}>
          <legend className="sr-only">
            Rovnice v kategorii {BALANCING_REACTION_CATEGORY_LABELS[category]}
          </legend>
          <div className={styles.pickerToolbar}>
            <span aria-hidden="true">{BALANCING_REACTION_CATEGORY_LABELS[category]}</span>
            <button className={styles.secondaryButton} onClick={onToggleCategory} type="button">
              {allSelected ? "Zrušit výběr kategorie" : `Vybrat všech ${categoryLessons.length}`}
            </button>
          </div>
          <ul className={styles.lessonList}>
            {categoryLessons.map((lesson) => (
              <li key={lesson.id}>
                <label className={styles.lessonOption}>
                  <input
                    checked={selectedIds.has(lesson.id)}
                    onChange={() => onToggleLesson(lesson.id)}
                    type="checkbox"
                    value={lesson.id}
                  />
                  <span className={styles.lessonOptionTitle}>
                    <ChemicalText text={lesson.title} />
                  </span>
                  {completedIds.has(lesson.id) ? (
                    <span className={styles.completedMark}>✓ prošlá</span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <div className={styles.startBar}>
        <span className={styles.selectionCount} role="status">
          Vybráno: {czechCount(selectedIds.size, ["rovnice", "rovnice", "rovnic"])}
        </span>
        {selectedIds.size > 0 ? (
          <button className={styles.secondaryButton} onClick={onClear} type="button">
            Zrušit výběr
          </button>
        ) : null}
        <label className={styles.shuffleToggle}>
          <input
            checked={shuffle}
            onChange={(event) => onShuffleChange(event.target.checked)}
            type="checkbox"
          />
          Zamíchat pořadí
        </label>
        <button
          className={styles.primaryButton}
          disabled={selectedIds.size === 0}
          onClick={onStart}
          type="button"
        >
          Začít procvičovat
        </button>
      </div>
    </div>
  );
}

export function BalancingReactionsLesson({
  lessons,
}: Readonly<{ lessons: readonly BalancingReactionRuntimeLesson[] }>) {
  const lessonIds = useMemo(() => new Set(lessons.map((lesson) => lesson.id)), [lessons]);
  const [category, setCategory] = useState<BalancingCategory>(1);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [shuffle, setShuffle] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  // null while the student is choosing equations; otherwise the ids being walked through.
  const [queue, setQueue] = useState<readonly string[] | null>(null);
  const [position, setPosition] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingOnRender = useRef(false);

  const lesson = queue ? lessons.find((candidate) => candidate.id === queue[position]) : undefined;
  const step = lesson?.steps[stepIndex] ?? lesson?.steps[0];
  const actualStepIndex = lesson && step ? lesson.steps.indexOf(step) : 0;
  const onLastStep = lesson !== undefined && actualStepIndex === lesson.steps.length - 1;
  const lastInQueue = queue !== null && position === queue.length - 1;

  useEffect(() => {
    const selection = loadBalancingSelection(lessonIds);
    if (selection) {
      setSelectedIds(new Set(selection.lessonIds));
      setShuffle(selection.shuffle);
    }
    setCompletedIds(new Set(loadCompletedBalancingLessons(lessonIds)));
    setPreferencesLoaded(true);
  }, [lessonIds]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    saveBalancingSelection({
      lessonIds: lessons.filter((item) => selectedIds.has(item.id)).map((item) => item.id),
      shuffle,
    });
  }, [lessons, preferencesLoaded, selectedIds, shuffle]);

  useEffect(() => {
    if (!onLastStep || !lesson || completedIds.has(lesson.id)) return;
    const next = new Set(completedIds).add(lesson.id);
    setCompletedIds(next);
    saveCompletedBalancingLessons([...next]);
  }, [completedIds, lesson, onLastStep]);

  useEffect(() => {
    if (!focusHeadingOnRender.current) return;
    focusHeadingOnRender.current = false;
    headingRef.current?.focus();
  });

  function showView(nextQueue: readonly string[] | null, nextPosition = 0) {
    focusHeadingOnRender.current = true;
    setQueue(nextQueue);
    setPosition(nextPosition);
    setStepIndex(0);
  }

  function advance() {
    if (!queue || !lesson) return;
    if (!onLastStep) {
      setStepIndex(actualStepIndex + 1);
      return;
    }
    if (lastInQueue) {
      showView(queue, queue.length);
      return;
    }
    setPosition(position + 1);
    setStepIndex(0);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!lesson) return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest("select, input, textarea") || event.target.isContentEditable)
      )
        return;
      event.preventDefault();
      if (event.key === "ArrowRight") advance();
      else setStepIndex(Math.max(0, actualStepIndex - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function toggleLesson(lessonId: string) {
    const next = new Set(selectedIds);
    if (!next.delete(lessonId)) next.add(lessonId);
    setSelectedIds(next);
  }

  function toggleCategory() {
    const categoryLessons = lessons.filter((item) => item.category === category);
    const allSelected = categoryLessons.every((item) => selectedIds.has(item.id));
    const next = new Set(selectedIds);
    for (const item of categoryLessons) {
      if (allSelected) next.delete(item.id);
      else next.add(item.id);
    }
    setSelectedIds(next);
  }

  function start() {
    const ordered = lessons.filter((item) => selectedIds.has(item.id)).map((item) => item.id);
    if (ordered.length === 0) return;
    showView(shuffle ? shuffled(ordered) : ordered);
  }

  const algebraLesson = lesson?.steps.some((frame) => frame.title === "Odvozený celočíselný poměr");

  return (
    <section
      className={cn(styles.lesson, algebraLesson && styles.algebraLesson)}
      aria-label="Výukový průvodce vyčíslováním reakcí"
    >
      {queue === null ? (
        <EquationPicker
          category={category}
          completedIds={completedIds}
          headingRef={headingRef}
          lessons={lessons}
          onCategoryChange={setCategory}
          onClear={() => setSelectedIds(new Set())}
          onShuffleChange={setShuffle}
          onStart={start}
          onToggleCategory={toggleCategory}
          onToggleLesson={toggleLesson}
          selectedIds={selectedIds}
          shuffle={shuffle}
        />
      ) : !lesson || !step ? (
        <div className={styles.setComplete}>
          <h2 className={styles.pickerTitle} ref={headingRef} tabIndex={-1}>
            Sada je hotová
          </h2>
          <p className={styles.pickerHint}>
            Prošli jste {czechCount(queue.length, ["rovnici", "rovnice", "rovnic"])} až ke shrnutí.
          </p>
          <div className={styles.setCompleteActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => showView(queue)}
              type="button"
            >
              Projít znovu
            </button>
            <button className={styles.primaryButton} onClick={() => showView(null)} type="button">
              Vybrat další rovnice
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.lessonLayout}>
          <div className={styles.leftColumn}>
            <div className={styles.playerBar}>
              <button className={styles.textButton} onClick={() => showView(null)} type="button">
                ← Výběr rovnic
              </button>
              <span className={styles.queuePosition}>
                Rovnice {position + 1} z {queue.length}
              </span>
              <button
                className={styles.textButton}
                disabled={onLastStep}
                onClick={() => setStepIndex(lesson.steps.length - 1)}
                type="button"
              >
                Na shrnutí
              </button>
            </div>
            <header className={styles.lessonHeader}>
              <span className={styles.eyebrow}>
                Kategorie {lesson.category} · {BALANCING_REACTION_CATEGORY_LABELS[lesson.category]}
              </span>
              <h2 className={styles.lessonTitle} ref={headingRef} tabIndex={-1}>
                <ChemicalText text={lesson.title} />
              </h2>
              <details className={styles.lessonDetails}>
                <summary>O reakci</summary>
                <p className={styles.theoryContext}>
                  <ChemicalText text={lesson.theoryContext} />
                </p>
                {lesson.condition ? <p>Podmínka: {lesson.condition}</p> : null}
                {lesson.phase ? <p>Skupenství: {lesson.phase}</p> : null}
                {lesson.note ? (
                  <p>
                    Poznámka: <ChemicalText text={lesson.note} />
                  </p>
                ) : null}
              </details>
            </header>

            <div aria-live="polite" className={styles.stepPanel}>
              <p className={styles.stepTitle}>Aktuální krok: {step.title}</p>
              <p className={styles.stepExplanation}>
                <ChemicalText text={step.explanation} />
              </p>
              <ReactionEquation
                current={step.equation}
                showVariables={algebraLesson ?? false}
                isSummary={step.kind === "summary"}
                focusedSpecies={step.focusedSpecies}
                coefficientChanges={step.coefficientChanges}
                history={lesson.steps.slice(0, actualStepIndex)}
              />
              <BalanceCards step={step} />
              <div className={styles.stepBody}>
                {step.ruleHighlight ? (
                  <p className={styles.ruleHighlight}>
                    <strong>Pravidlo:</strong> <ChemicalText text={step.ruleHighlight} />
                  </p>
                ) : null}
              </div>
            </div>

            <div className={styles.stepNavigation}>
              <button
                disabled={actualStepIndex === 0}
                onClick={() => setStepIndex(Math.max(0, actualStepIndex - 1))}
                type="button"
              >
                ← Zpět
              </button>
              <span className={styles.stepCounter}>
                Krok {actualStepIndex + 1} z {lesson.steps.length}
                <span className="sr-only">. Použijte šipky vlevo a vpravo pro změnu kroku.</span>
              </span>
              <button onClick={advance} type="button">
                {!onLastStep ? "Další krok →" : lastInQueue ? "Dokončit sadu →" : "Další rovnice →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
