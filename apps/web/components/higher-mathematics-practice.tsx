"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";

import type { MathTopic } from "@inorganic/content/higher-mathematics";
import { MathText } from "@/components/math-text";

export function HigherMathematicsPractice({ topic }: Readonly<{ topic: MathTopic }>) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [revealedHints, setRevealedHints] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [finished, setFinished] = useState(false);
  const exercise = topic.exercises[index];

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exercise || submitted || !answer.trim()) return;
    const accepted = [exercise.answer, ...(exercise.acceptedAnswers ?? [])].map(
      normalizeMathAnswer,
    );
    const isCorrect = accepted.includes(normalizeMathAnswer(answer));
    setHasChecked(true);
    setSubmitted(isCorrect);
    if (isCorrect) setCorrectCount((count) => count + 1);
    else setIncorrectCount((count) => count + 1);
  }

  function advance() {
    if (index + 1 >= topic.exercises.length) {
      setFinished(true);
      return;
    }
    setIndex((current) => current + 1);
    setAnswer("");
    setSubmitted(false);
    setHasChecked(false);
    setRevealedHints(0);
    setShowSolution(false);
  }

  function restart() {
    setIndex(0);
    setAnswer("");
    setSubmitted(false);
    setHasChecked(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setRevealedHints(0);
    setShowSolution(false);
    setFinished(false);
  }

  if (finished) {
    return (
      <section
        className="rounded-2xl border border-line bg-surface p-5 sm:p-7"
        aria-labelledby="math-result-title"
      >
        <h2 className="font-display text-2xl font-bold text-ink" id="math-result-title">
          Okruh dokončen
        </h2>
        <p className="mt-3 text-ink-2" role="status">
          Správné odpovědi: {correctCount} · Nesprávné pokusy: {incorrectCount} · Celkem úloh:{" "}
          {topic.exercises.length}.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={primaryButtonClass} onClick={restart} type="button">
            Procvičit znovu
          </button>
          <Link className={secondaryButtonClass} href="/procvicovani/matematika">
            Zpět na přehled okruhů
          </Link>
        </div>
      </section>
    );
  }

  if (!exercise) return null;

  return (
    <section className="grid gap-4" aria-label={`Procvičování: ${topic.title}`}>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="mr-auto">
          <p className="font-mono text-sm font-semibold text-ink-2">
            Úloha {index + 1} z {topic.exercises.length}
          </p>
          <div
            className="mt-2 h-2 w-48 max-w-full overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-label="Postup okruhem"
            aria-valuemin={0}
            aria-valuemax={topic.exercises.length}
            aria-valuenow={index + 1}
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${((index + 1) / topic.exercises.length) * 100}%` }}
            />
          </div>
        </div>
        <span className="rounded-full bg-good-soft px-3 py-1.5 text-sm font-semibold text-good">
          Správně: {correctCount}
        </span>
        <span className="rounded-full bg-bad-soft px-3 py-1.5 text-sm font-semibold text-bad">
          Nesprávně: {incorrectCount}
        </span>
        <button className={quietButtonClass} onClick={restart} type="button">
          Začít znovu
        </button>
      </div>

      <article className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-wide text-accent-strong">Zadání</p>
        <h2 className="mt-3 text-lg leading-8 font-semibold text-ink" id="math-exercise-prompt">
          <MathText>{exercise.prompt}</MathText>
        </h2>

        {exercise.hints.length > 0 ? (
          <div className="mt-5">
            <button
              aria-expanded={revealedHints > 0}
              className={quietButtonClass}
              onClick={() =>
                setRevealedHints((count) => Math.min(count + 1, exercise.hints.length))
              }
              type="button"
            >
              {revealedHints === 0
                ? "Zobrazit nápovědu"
                : revealedHints < exercise.hints.length
                  ? "Další nápověda"
                  : "Nápovědy zobrazeny"}
            </button>
            {revealedHints > 0 ? (
              <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-6 text-ink-2">
                {exercise.hints.slice(0, revealedHints).map((hint) => (
                  <li key={`${exercise.id}-hint-${hint}`}>
                    <MathText>{hint}</MathText>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}

        <form
          className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={submitAnswer}
        >
          <label className="grid gap-1.5 text-sm font-semibold text-ink" htmlFor="math-answer">
            Vaše odpověď
            <input
              aria-describedby="math-answer-hint"
              autoComplete="off"
              className="min-h-12 rounded-xl border border-line-strong bg-surface px-3 text-base font-normal text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/25"
              id="math-answer"
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="např. 1/2, sqrt(5), x=2"
              value={answer}
            />
          </label>
          <button
            className={primaryButtonClass}
            disabled={!answer.trim() || submitted}
            type="submit"
          >
            Vyhodnotit
          </button>
        </form>
        <p className="mt-2 text-xs leading-5 text-ink-3" id="math-answer-hint">
          Zadejte výsledek v běžném zápisu. Ekvivalentní algebraické tvary se automaticky
          nerozpoznávají.
        </p>

        {submitted ? (
          <p
            className="mt-4 rounded-xl bg-good-soft p-3 text-sm font-semibold text-good"
            role="status"
          >
            Správně. Pokračujte k odůvodnění nebo další úloze.
          </p>
        ) : hasChecked ? (
          <p
            className="mt-4 rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad"
            role="status"
          >
            Odpověď zatím nesouhlasí. Zkontrolujte postup a zkuste ji upravit.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className={secondaryButtonClass}
            onClick={() => setShowSolution((visible) => !visible)}
            type="button"
          >
            {showSolution ? "Skrýt řešení" : "Zobrazit řešení"}
          </button>
          {submitted || showSolution ? (
            <button className={primaryButtonClass} onClick={advance} type="button">
              {index + 1 === topic.exercises.length ? "Dokončit okruh" : "Další úloha"}
            </button>
          ) : null}
        </div>

        {showSolution ? (
          <section
            className="mt-5 rounded-xl border border-line bg-surface-2 p-4 sm:p-5"
            aria-labelledby="math-solution-title"
          >
            <h3 className="font-display text-base font-bold text-ink" id="math-solution-title">
              Řešení krok za krokem
            </h3>
            <ol className="mt-3 grid list-decimal gap-2 pl-5 leading-7 text-ink-2">
              {exercise.solutionSteps.map((step) => (
                <li key={`${exercise.id}-step-${step}`}>
                  <MathText>{step}</MathText>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-line pt-3 font-semibold text-ink">
              Výsledek: <MathText>{exercise.answerLabel ?? exercise.answer}</MathText>
            </p>
          </section>
        ) : null}
      </article>
    </section>
  );
}

function normalizeMathAnswer(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("cs-CZ")
    .replaceAll("−", "-")
    .replaceAll("×", "*")
    .replaceAll("·", "*")
    .replaceAll("∞", "inf")
    .replaceAll("π", "pi")
    .replaceAll("∪", "U")
    .replaceAll(/√\s*\(([^()]+)\)/g, "sqrt($1)")
    .replaceAll(/√\s*([0-9]+)/g, "sqrt($1)")
    .replaceAll(/\\(?:left|right)/g, "")
    .replaceAll(/\\cdot/g, "*")
    .replaceAll(/\\cup/g, "U")
    .replaceAll(/\\infty/g, "inf")
    .replaceAll(/\\pi/g, "pi")
    .replaceAll(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1/$2")
    .replaceAll(/\\sqrt\s*\{([^{}]+)\}/g, "sqrt($1)")
    .replaceAll(/\^\{([^{}]+)\}/g, "^($1)")
    .replaceAll(/_\{([^{}]+)\}/g, "_$1")
    .replaceAll(/\\([a-z]+)/g, "$1")
    .replaceAll(/_([0-9]+)/g, "$1")
    .replaceAll(/[{}]/g, "")
    .replaceAll(/\s+/g, "")
    .replaceAll(/^\$|\$$/g, "");
}

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-fill hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const quietButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-accent-strong hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
