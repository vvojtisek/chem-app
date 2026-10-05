"use client";

import {
  BALANCING_REACTION_CATEGORIES,
  BALANCING_REACTION_CATEGORY_LABELS,
  type BalancingReactionRuntimeLesson,
  type BalancingReactionRuntimeSpecies,
} from "@inorganic/content/balancing-reactions";
import { useEffect, useMemo, useState } from "react";
import { ChemicalText } from "@/components/chemical-text";
import { Formula } from "@/components/formula";
import { cn } from "@/lib/class-names";
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

export function BalancingReactionsLesson({
  lessons,
}: Readonly<{ lessons: readonly BalancingReactionRuntimeLesson[] }>) {
  const [category, setCategory] = useState<(typeof BALANCING_REACTION_CATEGORIES)[number]>(1);
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [stepIndex, setStepIndex] = useState(0);
  const categoryLessons = useMemo(
    () => lessons.filter((lesson) => lesson.category === category),
    [category, lessons],
  );
  const lesson =
    categoryLessons.find((candidate) => candidate.id === lessonId) ?? categoryLessons[0];
  const step = lesson?.steps[stepIndex] ?? lesson?.steps[0];
  const actualStepIndex = lesson && step ? lesson.steps.indexOf(step) : 0;

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
      setStepIndex((current) =>
        Math.max(
          0,
          Math.min(lesson.steps.length - 1, current + (event.key === "ArrowRight" ? 1 : -1)),
        ),
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lesson]);

  function changeCategory(nextCategory: (typeof BALANCING_REACTION_CATEGORIES)[number]) {
    setCategory(nextCategory);
    const nextLesson = lessons.find((candidate) => candidate.category === nextCategory);
    setLessonId(nextLesson?.id ?? "");
    setStepIndex(0);
  }

  function changeLesson(nextLessonId: string) {
    setLessonId(nextLessonId);
    setStepIndex(0);
  }

  return (
    <section
      className={cn(
        styles.lesson,
        lesson?.steps.some((frame) => frame.title === "Odvozený celočíselný poměr") &&
          styles.algebraLesson,
      )}
      aria-label="Výukový průvodce vyčíslováním reakcí"
    >
      <nav aria-label="Kategorie reakcí" className={styles.categoryNav}>
        <div className={styles.categoryList}>
          {BALANCING_REACTION_CATEGORIES.map((option) => {
            const count = lessons.filter((candidate) => candidate.category === option).length;
            return (
              <button
                aria-pressed={category === option}
                className={`${styles.categoryButton} ${
                  category === option ? styles.categoryButtonActive : ""
                }`}
                key={option}
                onClick={() => changeCategory(option)}
                type="button"
              >
                <span className={styles.categoryNumber}>{option}.</span>{" "}
                {BALANCING_REACTION_CATEGORY_LABELS[option]}{" "}
                <span className={styles.categoryCount}>({count})</span>
              </button>
            );
          })}
        </div>
      </nav>

      {!lesson || !step ? (
        <p className={styles.emptyState} role="status">
          Tato kategorie zatím nemá připravenou interaktivní lekci.
        </p>
      ) : (
        <div className={styles.lessonLayout}>
          <div className={styles.leftColumn}>
            <header className={styles.lessonHeader}>
              <span className={styles.eyebrow}>
                Kategorie {lesson.category} · {BALANCING_REACTION_CATEGORY_LABELS[lesson.category]}
              </span>
              <h2 className={styles.lessonTitle}>
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
            {categoryLessons.length > 1 ? (
              <label className={styles.lessonSelector}>
                Reakce v této kategorii
                <select onChange={(event) => changeLesson(event.target.value)} value={lesson.id}>
                  {categoryLessons.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div aria-live="polite" className={styles.stepPanel}>
              <p className={styles.stepTitle}>Aktuální krok: {step.title}</p>
              <p className={styles.stepExplanation}>
                <ChemicalText text={step.explanation} />
              </p>
              <ReactionEquation
                current={step.equation}
                showVariables={lesson.steps.some(
                  (frame) => frame.title === "Odvozený celočíselný poměr",
                )}
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
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                type="button"
              >
                ← Zpět
              </button>
              <span className={styles.stepCounter}>
                Krok {actualStepIndex + 1} z {lesson.steps.length}
                <span className="sr-only">. Použijte šipky vlevo a vpravo pro změnu kroku.</span>
              </span>
              <button
                disabled={actualStepIndex === lesson.steps.length - 1}
                onClick={() =>
                  setStepIndex((current) => Math.min(lesson.steps.length - 1, current + 1))
                }
                type="button"
              >
                Další krok →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
