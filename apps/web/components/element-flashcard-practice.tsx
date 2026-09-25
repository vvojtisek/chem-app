"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  PeriodicTableSelectionStep,
  useSharedElementSelection,
} from "@/components/periodic-table-selection-step";
import { PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import { createPeriodicTableLayout } from "@/lib/periodic-table-layout";
import { drawSeries, selectElements } from "@/lib/periodic-table-scope";

const SESSION_DURATION_MS = 5 * 60 * 1000;

interface AnswerFeedback {
  readonly answer: string;
  readonly isCorrect: boolean;
}

export function ElementFlashcardPractice({
  elements,
  random = Math.random,
}: {
  readonly elements: readonly ElementFlashcardData[];
  readonly random?: () => number;
}) {
  const layout = useMemo(() => createPeriodicTableLayout(elements), [elements]);
  const [selection, setSelection] = useSharedElementSelection(layout);
  const selectedElements = useMemo(() => selectElements(layout, selection), [layout, selection]);
  const [phase, setPhase] = useState<"selection" | "running" | "summary">("selection");
  const [questions, setQuestions] = useState<readonly ElementFlashcardData[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { elapsedMs, start: startStopwatch, stop: stopStopwatch } = useStopwatch();
  const remainingTimeMs = Math.max(0, SESSION_DURATION_MS - elapsedMs);
  const current = questions[questionIndex];
  const answered = correct + incorrect;
  const remainingCards = Math.max(0, questions.length - questionIndex - (feedback ? 1 : 0));

  function startRound() {
    if (selectedElements.length === 0) return;
    setQuestions(drawSeries(selectedElements, selectedElements.length, random));
    setQuestionIndex(0);
    setAnswer("");
    setFeedback(null);
    setCorrect(0);
    setIncorrect(0);
    setNotice("");
    startStopwatch();
    setPhase("running");
  }

  function finishRound() {
    if (phase !== "running") return;
    stopStopwatch();
    setPhase("summary");
  }

  useEffect(() => {
    if (phase === "running" && remainingTimeMs === 0) {
      stopStopwatch();
      setPhase("summary");
    }
  }, [phase, remainingTimeMs, stopStopwatch]);

  useEffect(() => {
    if (phase === "running" && !feedback) inputRef.current?.focus();
  }, [phase, feedback]);

  function reveal(answerText: string, knewIt: boolean) {
    if (phase !== "running" || feedback || !current) return;
    if (knewIt && !answerText.trim()) {
      setNotice("Napište značku prvku, nebo zvolte „Nevím“.");
      inputRef.current?.focus();
      return;
    }
    setNotice("");
    setFeedback({
      answer: answerText.trim(),
      isCorrect: knewIt && answerText.trim() === current.symbol,
    });
    if (knewIt && answerText.trim() === current.symbol) {
      setCorrect((count) => count + 1);
    } else {
      setIncorrect((count) => count + 1);
    }
  }

  function nextCard() {
    if (!feedback) return;
    if (questionIndex + 1 >= questions.length) {
      finishRound();
      return;
    }
    setQuestionIndex((index) => index + 1);
    setAnswer("");
    setFeedback(null);
    setNotice("");
  }

  function changeSelection() {
    stopStopwatch();
    setQuestions([]);
    setQuestionIndex(0);
    setAnswer("");
    setFeedback(null);
    setPhase("selection");
  }

  if (elements.length === 0) {
    return <p role="status">K dispozici nejsou žádné prvky k procvičování.</p>;
  }

  return (
    <section aria-labelledby="flashcard-practice-heading" className="mx-auto w-full max-w-5xl">
      <header>
        <p className="text-sm font-semibold tracking-[0.16em] text-good uppercase">
          Pětiminutový kvíz
        </p>
        <h1
          className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-5xl"
          id="flashcard-practice-heading"
        >
          Značky prvků
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-ink-2">
          Podle českého názvu si vybavte značku prvku. Vyberte prvky a spusťte časovaný kvíz.
        </p>
      </header>

      {phase === "selection" ? (
        <div className="mt-7">
          <PeriodicTableSelectionStep
            layout={layout}
            onChange={setSelection}
            onStart={startRound}
            selection={selection}
          />
        </div>
      ) : null}

      {phase === "running" ? (
        <div className="mt-6 grid gap-5">
          <section
            aria-label="Průběh kvízu"
            className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-sm backdrop-blur"
          >
            <span className="rounded-full bg-good-soft px-3 py-1 text-sm font-semibold text-good">
              Správně: {correct}
            </span>
            <span className="rounded-full bg-bad-soft px-3 py-1 text-sm font-semibold text-bad">
              Špatně: {incorrect}
            </span>
            <span className="rounded-full bg-surface-3 px-3 py-1 text-sm font-semibold text-ink">
              Zbývá: {remainingCards}
            </span>
            <span className="rounded-full bg-surface-3 px-3 py-1 text-sm font-semibold text-ink">
              Čas{" "}
              <span className="font-mono tabular-nums" role="timer">
                {formatRemaining(remainingTimeMs)}
              </span>
            </span>
            <div className="ml-auto flex gap-2">
              <button
                className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold text-ink"
                onClick={startRound}
                type="button"
              >
                Reset
              </button>
              <button
                className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill"
                onClick={finishRound}
                type="button"
              >
                Ukončit
              </button>
            </div>
          </section>

          {current ? (
            <article
              aria-label={`Karta ${questionIndex + 1} z ${questions.length}`}
              className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-8"
            >
              <p className="text-sm font-medium text-ink-2">
                Karta {questionIndex + 1} z {questions.length}
              </p>
              <div className="mt-4 [perspective:1000px]">
                <div
                  className="relative min-h-64 transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d]"
                  style={{ transform: feedback ? "rotateY(180deg)" : "rotateY(0deg)" }}
                >
                  <div
                    aria-hidden={feedback !== null}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-surface-2 p-5 text-center [backface-visibility:hidden]"
                  >
                    <p className="text-sm font-semibold tracking-wide text-ink-2 uppercase">
                      Jaká je chemická značka?
                    </p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                      {current.nameCs}
                    </h2>
                    <form
                      className="mt-6 flex w-full max-w-md flex-wrap justify-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        reveal(answer, true);
                      }}
                    >
                      <label className="sr-only" htmlFor="element-symbol-answer">
                        Chemická značka
                      </label>
                      <input
                        autoComplete="off"
                        className="min-h-12 min-w-40 flex-1 rounded-xl border border-line-strong bg-surface px-4 text-center text-xl font-semibold"
                        disabled={feedback !== null}
                        id="element-symbol-answer"
                        onChange={(event) => setAnswer(event.target.value)}
                        ref={inputRef}
                        value={answer}
                      />
                      <button
                        className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-on-fill disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={feedback !== null}
                        type="submit"
                      >
                        Enter · Otočit
                      </button>
                    </form>
                    <button
                      className="mt-3 min-h-11 rounded-xl border border-line-strong px-4 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={feedback !== null}
                      onClick={() => reveal("", false)}
                      type="button"
                    >
                      Nevím
                    </button>
                  </div>
                  <div
                    aria-hidden={feedback === null}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-surface-2 p-5 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]"
                  >
                    <p className="text-sm font-semibold tracking-wide text-ink-2 uppercase">
                      {current.nameCs}
                    </p>
                    <p className="mt-3 text-7xl font-bold tracking-tight text-ink sm:text-8xl">
                      {current.symbol}
                    </p>
                    {feedback ? (
                      <p
                        aria-live="polite"
                        className={`mt-4 rounded-full px-4 py-2 font-semibold ${
                          feedback.isCorrect ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
                        }`}
                        role="status"
                      >
                        {feedback.isCorrect
                          ? "Správně."
                          : feedback.answer
                            ? `Špatně. Vaše odpověď: ${feedback.answer}.`
                            : "Nevadí, příště to vyjde."}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              {notice ? (
                <p className="mt-3 text-center text-sm text-warn" role="alert">
                  {notice}
                </p>
              ) : null}
              {feedback ? (
                <button
                  className="mt-5 min-h-12 w-full rounded-xl bg-accent px-5 font-semibold text-on-fill sm:w-auto"
                  onClick={nextCard}
                  type="button"
                >
                  Další
                </button>
              ) : null}
            </article>
          ) : null}
        </div>
      ) : null}

      {phase === "summary" ? (
        <div className="mt-6">
          <PracticeSummary
            correct={correct}
            elapsedMs={elapsedMs}
            focusOnMount
            incorrect={incorrect}
            solved={answered}
            solvedLabel="Zodpovězeno"
            total={questions.length}
          >
            <button
              className="mt-4 min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill"
              onClick={startRound}
              type="button"
            >
              Zkusit znovu
            </button>
            <button
              className="mt-4 ml-2 min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
              onClick={changeSelection}
              type="button"
            >
              Změnit výběr
            </button>
          </PracticeSummary>
        </div>
      ) : null}
    </section>
  );
}

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
