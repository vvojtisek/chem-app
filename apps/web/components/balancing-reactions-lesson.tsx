"use client";

import {
  BALANCING_REACTION_CATEGORIES,
  BALANCING_REACTION_CATEGORY_LABELS,
  type BalancingReactionRuntimeLesson,
  type BalancingReactionRuntimeSpecies,
} from "@inorganic/content/balancing-reactions";
import { useEffect, useMemo, useState } from "react";
import { Formula } from "@/components/formula";

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
  coefficientChanged,
}: Readonly<{
  term: BalancingReactionRuntimeSpecies;
  focused: boolean;
  coefficientChanged: boolean;
}>) {
  const highlighted = focused || coefficientChanged;
  return (
    <span
      className={`inline-flex items-baseline rounded-lg px-1 py-1 transition-colors ${
        highlighted ? "bg-flame-soft text-ink" : ""
      }`}
      data-active={highlighted ? "true" : undefined}
    >
      {term.coefficient !== 1 ? (
        <span
          className={`mr-1 font-bold tabular-nums ${
            coefficientChanged ? "reaction-coefficient-active text-accent-strong" : ""
          }`}
        >
          {term.coefficient}
        </span>
      ) : null}
      <Formula charge={term.charge} formula={term.formula} />
    </span>
  );
}

function ReactionEquation({
  current,
  previous,
  focusedSpecies,
}: Readonly<{
  current: BalancingReactionRuntimeLesson["steps"][number]["equation"];
  previous: BalancingReactionRuntimeLesson["steps"][number]["equation"] | undefined;
  focusedSpecies: readonly string[];
}>) {
  const changed = (term: BalancingReactionRuntimeSpecies, side: "reactant" | "product") => {
    const previousTerms = side === "reactant" ? previous?.reactants : previous?.products;
    const previousTerm = previousTerms?.find(
      (candidate) => candidate.formula === term.formula && candidate.charge === term.charge,
    );
    return previousTerm ? previousTerm.coefficient !== term.coefficient : term.coefficient !== 1;
  };

  return (
    <div
      aria-label={describeEquation(current.reactants, current.products)}
      className="overflow-x-auto rounded-2xl border border-line bg-surface-2 px-3 py-5 text-center font-mono text-xl leading-loose sm:px-6 sm:text-2xl"
      role="img"
    >
      <div className="min-w-max">
        {current.reactants.map((term, index) => (
          <span key={`${term.formula}-${term.charge}`}>
            {index > 0 ? <span className="px-1 text-ink-3">+</span> : null}
            <ReactionTerm
              coefficientChanged={changed(term, "reactant")}
              focused={focusedSpecies.includes(speciesKey(term))}
              term={term}
            />
          </span>
        ))}
        <span className="px-3 text-ink-2">→</span>
        {current.products.map((term, index) => (
          <span key={`${term.formula}-${term.charge}`}>
            {index > 0 ? <span className="px-1 text-ink-3">+</span> : null}
            <ReactionTerm
              coefficientChanged={changed(term, "product")}
              focused={focusedSpecies.includes(speciesKey(term))}
              term={term}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function BalanceLedger({
  step,
}: Readonly<{ step: BalancingReactionRuntimeLesson["steps"][number] }>) {
  const atoms = step.balanceLedger?.atoms ?? [];
  const charge = step.balanceLedger?.charge;
  const redoxPairs = step.balanceLedger?.redoxPairs ?? [];

  return (
    <aside className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div>
        <h3 className="font-display text-lg font-bold text-ink">Kontrolní bilance</h3>
        <p className="mt-1 text-sm text-ink-2">Počty atomů v aktuálním kroku.</p>
      </div>
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[25rem] border-collapse text-left text-sm"
          aria-label="Kontrola atomů"
        >
          <thead>
            <tr className="border-b border-line text-ink-2">
              <th className="px-2 py-2 font-semibold" scope="col">
                Prvek
              </th>
              <th className="px-2 py-2 font-semibold" scope="col">
                Reaktanty
              </th>
              <th className="px-2 py-2 font-semibold" scope="col">
                Produkty
              </th>
              <th className="px-2 py-2 font-semibold" scope="col">
                Stav
              </th>
            </tr>
          </thead>
          <tbody>
            {atoms.map((atom) => {
              const balanced = atom.reactants === atom.products;
              return (
                <tr className="border-b border-line last:border-0" key={atom.element}>
                  <th className="px-2 py-2 font-semibold text-ink" scope="row">
                    {atom.element}
                  </th>
                  <td className="px-2 py-2 tabular-nums text-ink">{atom.reactants}</td>
                  <td className="px-2 py-2 tabular-nums text-ink">{atom.products}</td>
                  <td className={`px-2 py-2 font-semibold ${balanced ? "text-good" : "text-warn"}`}>
                    {balanced ? "✓ souhlasí" : "≠ doplnit"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {charge ? (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <p className="font-semibold text-ink">Celkový iontový náboj</p>
          <p className="mt-1 text-ink-2">
            ΣQ reaktantů = <strong className="text-ink">{charge.reactants}</strong>; ΣQ produktů ={" "}
            <strong className="text-ink">{charge.products}</strong>{" "}
            <span className="font-semibold text-good">
              {charge.reactants === charge.products ? "✓ souhlasí" : "≠ vyrovnat"}
            </span>
          </p>
        </div>
      ) : null}
      {redoxPairs.length > 0 ? (
        <div className="overflow-x-auto">
          <h4 className="mb-2 font-semibold text-ink">Oxidační čísla a elektrony</h4>
          <table
            className="w-full min-w-[25rem] border-collapse text-left text-sm"
            aria-label="Oxidační čísla"
          >
            <thead>
              <tr className="border-b border-line text-ink-2">
                <th className="px-2 py-2 font-semibold" scope="col">
                  Částice
                </th>
                <th className="px-2 py-2 font-semibold" scope="col">
                  Z
                </th>
                <th className="px-2 py-2 font-semibold" scope="col">
                  Na
                </th>
                <th className="px-2 py-2 font-semibold" scope="col">
                  Δe⁻
                </th>
              </tr>
            </thead>
            <tbody>
              {redoxPairs.map((pair) => (
                <tr className="border-b border-line last:border-0" key={pair.species}>
                  <th className="px-2 py-2 font-medium text-ink" scope="row">
                    {pair.species}
                  </th>
                  <td className="px-2 py-2 tabular-nums text-ink">{pair.fromOx}</td>
                  <td className="px-2 py-2 tabular-nums text-ink">{pair.toOx}</td>
                  <td className="px-2 py-2 tabular-nums text-ink">{pair.deltaE}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </aside>
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
    <section className="grid gap-5" aria-label="Výukový průvodce vyčíslováním reakcí">
      <nav aria-label="Kategorie reakcí">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BALANCING_REACTION_CATEGORIES.map((option) => {
            const count = lessons.filter((candidate) => candidate.category === option).length;
            return (
              <button
                aria-pressed={category === option}
                className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  category === option
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
                }`}
                key={option}
                onClick={() => changeCategory(option)}
                type="button"
              >
                <span className="mr-1 tabular-nums">{option}.</span>{" "}
                {BALANCING_REACTION_CATEGORY_LABELS[option]}{" "}
                <span className="ml-1 font-normal">({count})</span>
              </button>
            );
          })}
        </div>
      </nav>

      {!lesson || !step ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-ink-2" role="status">
          Tato kategorie zatím nemá připravenou interaktivní lekci.
        </p>
      ) : (
        <article className="grid gap-5 rounded-2xl border border-line bg-surface p-4 sm:p-6">
          <header className="grid gap-2">
            <span className="w-fit rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-strong">
              Kategorie {lesson.category} · {BALANCING_REACTION_CATEGORY_LABELS[lesson.category]}
            </span>
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">{lesson.title}</h2>
            <p className="rounded-xl border-l-4 border-flame bg-flame-soft px-4 py-3 leading-7 text-ink">
              {lesson.theoryContext}
            </p>
            {lesson.condition || lesson.phase || lesson.note ? (
              <dl className="grid gap-2 text-sm text-ink-2 sm:grid-cols-3">
                {lesson.condition ? (
                  <div>
                    <dt className="font-semibold text-ink">Podmínka</dt>
                    <dd>{lesson.condition}</dd>
                  </div>
                ) : null}
                {lesson.phase ? (
                  <div>
                    <dt className="font-semibold text-ink">Skupenství</dt>
                    <dd>{lesson.phase}</dd>
                  </div>
                ) : null}
                {lesson.note ? (
                  <div>
                    <dt className="font-semibold text-ink">Poznámka</dt>
                    <dd>{lesson.note}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </header>

          {categoryLessons.length > 1 ? (
            <label className="grid max-w-xl gap-2 font-semibold text-ink">
              Reakce v této kategorii
              <select
                className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 font-normal"
                onChange={(event) => changeLesson(event.target.value)}
                value={lesson.id}
              >
                {categoryLessons.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div aria-live="polite">
            <p className="text-sm font-semibold text-ink-2">Aktuální krok: {step.title}</p>
            <div className="mt-3">
              <ReactionEquation
                current={step.equation}
                focusedSpecies={step.focusedSpecies}
                previous={lesson.steps[actualStepIndex - 1]?.equation}
              />
            </div>
            <p className="mt-4 max-w-3xl leading-7 text-ink">{step.explanation}</p>
            {step.ruleHighlight ? (
              <p className="mt-3 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-6 text-accent-strong">
                <strong>Pravidlo:</strong> {step.ruleHighlight}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-4">
            <button
              className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-45"
              disabled={actualStepIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              type="button"
            >
              ← Zpět
            </button>
            <span className="text-sm font-semibold tabular-nums text-ink-2">
              Krok {actualStepIndex + 1} z {lesson.steps.length}
              <span className="sr-only">. Použijte šipky vlevo a vpravo pro změnu kroku.</span>
            </span>
            <button
              className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:cursor-not-allowed disabled:opacity-45"
              disabled={actualStepIndex === lesson.steps.length - 1}
              onClick={() =>
                setStepIndex((current) => Math.min(lesson.steps.length - 1, current + 1))
              }
              type="button"
            >
              Další krok →
            </button>
          </div>

          <BalanceLedger step={step} />
        </article>
      )}
    </section>
  );
}
