"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";

import type { MathTopic } from "@inorganic/content/higher-mathematics";
import workspace from "@/components/subject-workspace.module.css";
import { cn } from "@/lib/class-names";
import { MathText } from "./math-text";
import styles from "./practice.module.css";
import { MATH_PRACTICE_PATH } from "./routes";

/** Runs the exercises of one section; state lives only in this component. */
export function MathPracticeSession({ topic }: Readonly<{ topic: MathTopic }>) {
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
  const total = topic.exercises.length;

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
    if (index + 1 >= total) {
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
      <section aria-labelledby="math-result-title" className={workspace.card}>
        <h2 className={styles.sectionHeading} id="math-result-title">
          Okruh dokončen
        </h2>
        <p role="status">
          Správné odpovědi: {correctCount} · Nesprávné pokusy: {incorrectCount} · Celkem úloh:{" "}
          {total}.
        </p>
        <div className={workspace.actions}>
          <button className={workspace.primaryButton} onClick={restart} type="button">
            Procvičit znovu
          </button>
          <Link className={styles.linkButton} href={MATH_PRACTICE_PATH}>
            Zpět na přehled okruhů
          </Link>
        </div>
      </section>
    );
  }

  if (!exercise) return null;

  return (
    <section aria-labelledby="math-practice-title" className="grid min-w-0 gap-3">
      <h2 className={styles.sectionHeading} id="math-practice-title">
        Procvičování
      </h2>
      <div className={styles.progress}>
        <p className={workspace.stepNumber}>
          Úloha {index + 1} z {total}
        </p>
        <div
          aria-label="Postup okruhem"
          aria-valuemax={total}
          aria-valuemin={0}
          aria-valuenow={index + 1}
          className={styles.progressBar}
          role="progressbar"
        >
          <div
            className={styles.progressFill}
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <span className={cn(styles.count, styles.good)}>Správně: {correctCount}</span>
        <span className={cn(styles.count, styles.bad)}>Nesprávně: {incorrectCount}</span>
        <button className={workspace.secondaryButton} onClick={restart} type="button">
          Začít znovu
        </button>
      </div>

      <article aria-labelledby="math-exercise-prompt" className={workspace.equation}>
        <p className={workspace.label}>Zadání</p>
        <h3 className={styles.prompt} id="math-exercise-prompt">
          <MathText>{exercise.prompt}</MathText>
        </h3>
      </article>

      {exercise.hints.length > 0 ? (
        <div className="grid gap-2">
          <div className={workspace.actions}>
            <button
              aria-expanded={revealedHints > 0}
              className={workspace.secondaryButton}
              disabled={revealedHints >= exercise.hints.length}
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
          </div>
          {revealedHints > 0 ? (
            <ol className={styles.hintList}>
              {exercise.hints.slice(0, revealedHints).map((hint) => (
                <li key={`${exercise.id}-hint-${hint}`}>
                  <MathText>{hint}</MathText>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      <form className={styles.answerForm} onSubmit={submitAnswer}>
        <label className={workspace.field} htmlFor="math-answer">
          <span className={workspace.label}>Vaše odpověď</span>
          <input
            aria-describedby="math-answer-hint"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className={workspace.input}
            id="math-answer"
            maxLength={200}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="např. 1/2, sqrt(5), x=2"
            spellCheck={false}
            value={answer}
          />
        </label>
        <button
          className={workspace.primaryButton}
          disabled={!answer.trim() || submitted}
          type="submit"
        >
          Vyhodnotit
        </button>
      </form>
      <p className={workspace.hint} id="math-answer-hint">
        Zápis: 2x^2, sin(x), e^x, ln(x), sqrt(x), pi, inf. Ekvivalentní algebraické tvary se
        automaticky nerozpoznávají.
      </p>

      <div aria-live="polite">
        {submitted ? (
          <p className={styles.feedbackGood} role="status">
            Správně. Pokračujte k odůvodnění nebo další úloze.
          </p>
        ) : hasChecked ? (
          <p className={styles.feedbackBad} role="status">
            Odpověď zatím nesouhlasí. Zkontrolujte postup a zkuste ji upravit.
          </p>
        ) : null}
      </div>

      <div className={workspace.actions}>
        <button
          aria-expanded={showSolution}
          className={workspace.secondaryButton}
          onClick={() => setShowSolution((visible) => !visible)}
          type="button"
        >
          {showSolution ? "Skrýt řešení" : "Zobrazit řešení"}
        </button>
        {submitted || showSolution ? (
          <button className={workspace.primaryButton} onClick={advance} type="button">
            {index + 1 === total ? "Dokončit okruh" : "Další úloha"}
          </button>
        ) : null}
      </div>

      {showSolution ? (
        <section aria-labelledby="math-solution-title" className="grid gap-2">
          <h3 className={workspace.cardTitle} id="math-solution-title">
            Řešení krok za krokem
          </h3>
          <ol aria-label="Kroky řešení" className={workspace.steps}>
            {exercise.solutionSteps.map((step, stepIndex) => (
              <li className={styles.stepRow} key={`${exercise.id}-step-${step}`}>
                <span className={workspace.stepNumber}>{stepIndex + 1}</span>
                <span className="min-w-0">
                  <MathText>{step}</MathText>
                </span>
              </li>
            ))}
          </ol>
          <p className={workspace.answer}>
            Výsledek: <MathText>{exercise.answerLabel ?? exercise.answer}</MathText>
          </p>
        </section>
      ) : null}
    </section>
  );
}

export function normalizeMathAnswer(value: string): string {
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
