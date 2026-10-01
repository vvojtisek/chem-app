"use client";

import { evaluateElementAnswer } from "@inorganic/chemistry";
import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  PeriodicTableSelectionStep,
  useSharedElementSelection,
} from "@/components/periodic-table-selection-step";
import { ElementCategoryBadge } from "@/components/element-category-badge";
import { PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import { createPeriodicTableLayout } from "@/lib/periodic-table-layout";
import { drawSeries, selectElements } from "@/lib/periodic-table-scope";

const SESSION_DURATION_MS = 5 * 60 * 1000;

type RecallDirection = "symbol" | "name";
type ExtraField = "atomicNumber" | "atomicWeight" | "valenceConfiguration";
type FactField = RecallDirection | ExtraField;
type Answers = Record<RecallDirection | ExtraField, string>;

const emptyAnswers: Answers = {
  symbol: "",
  name: "",
  atomicNumber: "",
  atomicWeight: "",
  valenceConfiguration: "",
};
const extraFields: readonly { readonly key: ExtraField; readonly label: string }[] = [
  { key: "atomicNumber", label: "Protonové číslo" },
  { key: "atomicWeight", label: "Relativní atomová hmotnost" },
  { key: "valenceConfiguration", label: "Valenční konfigurace" },
];

interface AnswerFeedback {
  readonly answers: Answers;
  readonly results: Readonly<Record<RecallDirection | ExtraField, boolean>>;
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
  const [roundId, setRoundId] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [direction, setDirection] = useState<RecallDirection>("symbol");
  const [extraSelection, setExtraSelection] = useState<readonly ExtraField[]>([]);
  const [roundDirection, setRoundDirection] = useState<RecallDirection>("symbol");
  const [roundExtras, setRoundExtras] = useState<readonly ExtraField[]>([]);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const { elapsedMs, start: startStopwatch, stop: stopStopwatch } = useStopwatch();
  const remainingTimeMs = Math.max(0, SESSION_DURATION_MS - elapsedMs);
  const current = questions[questionIndex];
  const answered = correct + incorrect;
  const remainingCards = Math.max(0, questions.length - questionIndex - (feedback ? 1 : 0));
  const cardFacts: readonly {
    readonly key: FactField;
    readonly label: string;
    readonly value: string;
  }[] = current
    ? [
        { key: "name", label: "Český název", value: current.nameCs },
        { key: "symbol", label: "Značka", value: current.symbol },
        { key: "atomicNumber", label: "Protonové číslo", value: String(current.atomicNumber) },
        {
          key: "atomicWeight",
          label: "Relativní atomová hmotnost",
          value: String(current.atomicWeight),
        },
        {
          key: "valenceConfiguration",
          label: "Valenční konfigurace",
          value: current.valenceConfiguration,
        },
      ]
    : [];

  function startRound() {
    if (selectedElements.length === 0) return;
    setRoundId((id) => id + 1);
    setQuestions(drawSeries(selectedElements, selectedElements.length, random));
    setRoundDirection(direction);
    setRoundExtras(extraSelection);
    setQuestionIndex(0);
    setAnswers(emptyAnswers);
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
    if (phase !== "running") return;
    if (feedback) {
      nextButtonRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [phase, feedback]);

  function reveal(knewIt: boolean) {
    if (phase !== "running" || feedback || !current) return;
    const requiredFields = [roundDirection, ...roundExtras];
    if (knewIt && requiredFields.some((field) => !answers[field].trim())) {
      setNotice("Vyplňte všechna zvolená pole, nebo zvolte „Nevím“.");
      inputRef.current?.focus();
      return;
    }
    const results: Record<RecallDirection | ExtraField, boolean> = {
      symbol: false,
      name: false,
      atomicNumber: false,
      atomicWeight: false,
      valenceConfiguration: false,
    };
    if (knewIt) {
      results[roundDirection] = evaluateElementAnswer(
        answers[roundDirection],
        current,
        roundDirection,
      ).isCorrect;
      results.atomicNumber = Number(answers.atomicNumber) === current.atomicNumber;
      results.atomicWeight =
        Number(answers.atomicWeight.replace(",", ".")) === current.atomicWeight;
      results.valenceConfiguration =
        answers.valenceConfiguration.normalize("NFKC").replace(/\s+/gu, "").toLowerCase() ===
        current.valenceConfiguration.normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
    }
    const isCorrect = knewIt && requiredFields.every((field) => results[field]);
    setNotice("");
    setFeedback({
      answers,
      results,
      isCorrect,
    });
    if (isCorrect) {
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
    setAnswers(emptyAnswers);
    setFeedback(null);
    setNotice("");
  }

  function changeSelection() {
    stopStopwatch();
    setQuestions([]);
    setQuestionIndex(0);
    setAnswers(emptyAnswers);
    setFeedback(null);
    setPhase("selection");
  }

  if (elements.length === 0) {
    return <p role="status">K dispozici nejsou žádné prvky k procvičování.</p>;
  }

  return (
    <section aria-labelledby="flashcard-practice-heading" className="mx-auto w-full max-w-5xl">
      <header>
        <p className="text-sm font-semibold text-ink-3">Pětiminutový kvíz</p>
        <h1
          className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          id="flashcard-practice-heading"
        >
          Karty prvků · kvíz
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-ink-2">
          Vyberte prvky a údaje, které si chcete vybavit. Na každou kartu máte jeden pokus.
        </p>
      </header>

      {phase === "selection" ? (
        <div className="mt-7">
          <fieldset className="mb-5 rounded-2xl border border-line bg-surface p-4">
            <legend className="px-1 font-semibold text-ink">Co chcete určit?</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["symbol", "Z názvu značku"],
                  ["name", "Ze značky název"],
                ] as const
              ).map(([value, label]) => (
                <button
                  aria-pressed={direction === value}
                  className={`min-h-11 rounded-xl border px-4 font-semibold ${
                    direction === value
                      ? "border-accent bg-accent text-on-fill"
                      : "border-line-strong text-ink"
                  }`}
                  key={value}
                  onClick={() => setDirection(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="mb-5 rounded-2xl border border-line bg-surface p-4">
            <legend className="px-1 font-semibold text-ink">Další údaje k otestování</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {extraFields.map(({ key, label }) => (
                <label
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-line-strong px-3 text-sm font-medium text-ink"
                  key={key}
                >
                  <input
                    checked={extraSelection.includes(key)}
                    className="h-5 w-5 accent-accent"
                    onChange={(event) =>
                      setExtraSelection((previous) =>
                        event.target.checked
                          ? [...previous, key]
                          : previous.filter((field) => field !== key),
                      )
                    }
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
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
                {/* Remount each prompt so it never animates back from the previous answer face. */}
                <div
                  key={`${roundId}-${questionIndex}`}
                  className="relative min-h-[29rem] transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d] sm:min-h-[24rem]"
                  style={{
                    transform: feedback ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  <div
                    aria-hidden={feedback !== null}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-surface-2 p-5 text-center [backface-visibility:hidden]"
                  >
                    <p className="text-sm font-semibold tracking-wide text-ink-2 uppercase">
                      {roundDirection === "symbol"
                        ? "Jaká je chemická značka?"
                        : "Jaký je český název?"}
                    </p>
                    <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                      {roundDirection === "symbol" ? current.nameCs : current.symbol}
                    </h2>
                    <form
                      className="mt-6 grid w-full max-w-md gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        reveal(true);
                      }}
                    >
                      <label className="grid gap-1 text-left text-sm font-medium text-ink-2">
                        {roundDirection === "symbol" ? "Chemická značka" : "Český název"}
                        <input
                          autoComplete="off"
                          className="min-h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-center text-lg font-semibold"
                          disabled={feedback !== null}
                          onChange={(event) =>
                            setAnswers((previous) => ({
                              ...previous,
                              [roundDirection]: event.target.value,
                            }))
                          }
                          ref={inputRef}
                          value={answers[roundDirection]}
                        />
                      </label>
                      {extraFields
                        .filter(({ key }) => roundExtras.includes(key))
                        .map(({ key, label }) => (
                          <label
                            className="grid gap-1 text-left text-sm font-medium text-ink-2"
                            key={key}
                          >
                            {label}
                            <input
                              autoComplete="off"
                              className="min-h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-center text-lg font-semibold"
                              disabled={feedback !== null}
                              inputMode={key === "valenceConfiguration" ? "text" : "decimal"}
                              onChange={(event) =>
                                setAnswers((previous) => ({
                                  ...previous,
                                  [key]: event.target.value,
                                }))
                              }
                              value={answers[key]}
                            />
                          </label>
                        ))}
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
                      onClick={() => reveal(false)}
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
                      {roundDirection === "symbol" ? current.nameCs : current.symbol}
                    </p>
                    <p className="mt-3 text-5xl font-bold tracking-tight text-ink sm:text-7xl">
                      {roundDirection === "symbol" ? current.symbol : current.nameCs}
                    </p>
                    {feedback ? <ElementCategoryBadge className="mt-2" element={current} /> : null}
                    {feedback ? (
                      <div
                        aria-live="polite"
                        className="mt-4 w-full max-w-lg text-left"
                        role="status"
                      >
                        <p
                          className={`mb-2 rounded-xl px-4 py-2 font-semibold ${
                            feedback.isCorrect ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
                          }`}
                        >
                          {feedback.isCorrect ? "Správně." : "Nevadí, příště to vyjde."}
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {cardFacts.map(({ key, label, value }) => {
                            const isTested =
                              key === roundDirection || roundExtras.includes(key as ExtraField);
                            const isCorrect = isTested && feedback.results[key];
                            const className = !isTested
                              ? "border-accent/40 bg-accent-soft text-ink"
                              : isCorrect
                                ? "border-good/40 bg-good-soft text-good"
                                : "border-bad/40 bg-bad-soft text-bad";
                            const answer = feedback.answers[key];
                            return (
                              <div
                                className={`min-w-0 rounded-xl border px-3 py-2 ${className}`}
                                key={key}
                              >
                                <p className="text-xs font-semibold leading-4">{label}</p>
                                {isTested && !isCorrect ? (
                                  <p className="mt-1 break-words text-sm leading-5">
                                    Vaše odpověď: {answer.trim() || "Nevím"}
                                    <br />
                                    Správně: {value}
                                  </p>
                                ) : (
                                  <p className="mt-1 break-words text-sm font-semibold leading-5">
                                    {isTested ? `Správně: ${value}` : value}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
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
                  ref={nextButtonRef}
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
