"use client";

import type { PreparationProductionRuntimeProduct } from "@inorganic/content/preparation-production";
import { type Ref, useEffect, useId, useMemo, useRef, useState } from "react";

import { AnswerFeedback } from "@/components/answer-feedback";
import { FinalAnswerReview } from "@/components/final-answer-review";
import { EquationSide } from "@/components/formula";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import {
  BalancedEquation,
  ByproductHintText,
  EquationTerms,
  KIND_LABELS,
  KINDS,
  MissedList,
  type MissedQuestion,
  QuizSetup,
  ROUTE_KIND_LABELS,
} from "@/components/production-quiz-parts";
import { ProductionRecallQuiz } from "@/components/production-recall-quiz";
import { NamedSubstance, QuestionTools } from "@/components/question-tools";
import { SegmentedChoice } from "@/components/segmented-choice";
import { drawSeries } from "@/lib/periodic-table-scope";
import { formulaNames, reactionByproductHint } from "@/lib/practice-hints";
import {
  answerPracticeQueue,
  createPracticeQueue,
  type PracticeQueueState,
  skipPracticeQueue,
} from "@/lib/practice-queue";
import type { ProductionQuizKind } from "@/lib/preparation-production-quiz";
import {
  loadProductionQuizMode,
  type ProductionQuizMode,
  saveProductionQuizMode,
} from "@/lib/production-quiz-preferences";
import {
  countProductionChoiceQuestions,
  createProductionChoiceQuiz,
  type ProductionChoiceQuestion,
  type ProductionRecallSettings,
} from "@/lib/production-recall";
import type { ReactionProductsOption } from "@/lib/reaction-products-quiz";
import type { ReportedQuestion } from "@/lib/report-question";

const OPTION_LETTERS = ["a", "b", "c", "d"] as const;
const MODE_OPTIONS: readonly { readonly value: ProductionQuizMode; readonly label: string }[] = [
  { value: "easy", label: "Lehká" },
  { value: "advanced", label: "Pokročilá" },
  { value: "pro", label: "Pro" },
];
const CHOICE_DESCRIPTION =
  "U každé otázky uvidíte výchozí látky s koeficienty. Vyberte, které produkty touto reakcí vzniknou. Možnosti a otázky jsou pokaždé v jiném pořadí. Chybně zodpovězená otázka se jednou vrátí na konec. Výsledek se zobrazí na konci kvízu; do pokroku se zatím nezapočítává.";

/**
 * The preparation and production quiz in three difficulties. Each shows a reaction left to
 * right: „Lehká“ shows the reactants and offers four product sets, „Pokročilá“ asks for the
 * products typed into slots after the arrow, and „Pro“ names only the substance and asks for
 * reactants and products in slots. The chosen difficulty is remembered on this device.
 * Switching it during a quiz starts a new quiz in the chosen difficulty with the same kind
 * and number of questions.
 */
export function ProductionQuiz({
  products,
  allowedSymbols,
  random = Math.random,
}: Readonly<{
  products: readonly PreparationProductionRuntimeProduct[];
  allowedSymbols: readonly string[];
  random?: () => number;
}>) {
  const [mode, setMode] = useState<ProductionQuizMode>("easy");
  const [settings, setSettings] = useState<ProductionRecallSettings>({ kind: "all", count: 10 });
  const [active, setActive] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const modeName = useId();

  // Read after mounting, so the server-rendered page and the first client render agree.
  useEffect(() => {
    const stored = loadProductionQuizMode();
    if (stored) setMode(stored);
  }, []);

  function changeMode(next: ProductionQuizMode) {
    if (next === mode) return;
    setAutoStart(active);
    setActive(false);
    setMode(next);
    saveProductionQuizMode(next);
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <SegmentedChoice
          legend="Obtížnost"
          name={modeName}
          onSelect={changeMode}
          options={MODE_OPTIONS}
          value={mode}
        />
      </div>
      {mode === "easy" ? (
        <ChoiceProductionQuiz
          allowedSymbols={allowedSymbols}
          autoStart={autoStart}
          key={mode}
          onActiveChange={setActive}
          onSettingsChange={setSettings}
          products={products}
          random={random}
          settings={settings}
        />
      ) : (
        <ProductionRecallQuiz
          allowedSymbols={allowedSymbols}
          autoStart={autoStart}
          key={mode}
          mode={mode === "advanced" ? "products" : "equation"}
          onActiveChange={setActive}
          onSettingsChange={setSettings}
          products={products}
          random={random}
          settings={settings}
        />
      )}
    </div>
  );
}

interface Feedback {
  readonly question: ProductionChoiceQuestion;
  readonly chosen: ReactionProductsOption;
  readonly isCorrect: boolean;
}

/**
 * Lehká: „reactants → ?“ with four product sets to choose from. The answer moves on at once and
 * its feedback sits under the next question. Options are reshuffled each time a question is
 * shown. Results stay in this session; the quiz does not record attempts.
 */
function ChoiceProductionQuiz({
  products,
  allowedSymbols,
  settings,
  onSettingsChange,
  autoStart,
  onActiveChange,
  random,
}: Readonly<{
  products: readonly PreparationProductionRuntimeProduct[];
  allowedSymbols: readonly string[];
  settings: ProductionRecallSettings;
  onSettingsChange: (settings: ProductionRecallSettings) => void;
  /** Starts a quiz on mounting, after the difficulty was switched during a quiz. */
  autoStart: boolean;
  onActiveChange: (active: boolean) => void;
  random: () => number;
}>) {
  const symbols = useMemo(() => new Set(allowedSymbols), [allowedSymbols]);
  const names = useMemo(() => formulaNames(products), [products]);
  const available = useMemo(
    () =>
      Object.fromEntries(
        KINDS.map((kind) => [kind, countProductionChoiceQuestions(products, kind, symbols)]),
      ) as Record<ProductionQuizKind, number>,
    [products, symbols],
  );
  const [session, setSession] = useState<PracticeQueueState<ProductionChoiceQuestion> | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [missed, setMissed] = useState<readonly MissedQuestion[]>([]);
  const [runId, setRunId] = useState(0);
  const stopwatch = useStopwatch();
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const plannedCount = Math.min(
    settings.count ?? available[settings.kind],
    available[settings.kind],
  );

  // Keeps the keyboard on the options after each answer; the old buttons are replaced.
  useEffect(() => {
    if (runId > 0) firstOptionRef.current?.focus();
  }, [runId]);

  const running = session?.status === "running";
  useEffect(() => onActiveChange(running), [running, onActiveChange]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the difficulty changed mid-quiz.
  useEffect(() => {
    if (autoStart) start();
  }, []);

  function start() {
    setShowResults(false);
    setSession(
      createPracticeQueue(createProductionChoiceQuiz(products, settings, symbols, random), random),
    );
    setFeedback(null);
    setMissed([]);
    stopwatch.start();
    setRunId((value) => value + 1);
  }

  function finish() {
    setShowResults(true);
    stopwatch.stop();
    setSession((current) =>
      current ? { ...current, status: "finished", current: null, queue: [] } : current,
    );
  }

  function answer(optionId: string) {
    if (!session?.current) return;
    const question = session.current;
    const chosen = question.options.find((option) => option.id === optionId);
    if (!chosen) return;
    // Graded by the set of product formulas, never by the position of the option.
    const isCorrect = optionId === question.answerId;
    const result = answerPracticeQueue(session, isCorrect);
    if (!result) return;
    setSession(result.state);
    setFeedback({ question, chosen, isCorrect });
    if (!isCorrect) {
      setMissed((previous) =>
        previous.some((item) => item.id === question.id)
          ? previous
          : [
              ...previous,
              {
                id: question.id,
                kind: question.kind,
                product: question.product,
                routes: [question.route],
              },
            ],
      );
    }
    if (result.state.status === "finished") stopwatch.stop();
    setRunId((value) => value + 1);
  }

  /** Puts the question at the end of the queue without grading it. */
  function skip() {
    if (!session?.current) return;
    setSession(skipPracticeQueue(session));
    setFeedback(null);
    setRunId((value) => value + 1);
  }

  if (!session) {
    return (
      <QuizSetup
        available={available}
        description={CHOICE_DESCRIPTION}
        helpId="production-easy"
        onChange={onSettingsChange}
        onStart={start}
        plannedCount={plannedCount}
        settings={settings}
      />
    );
  }

  const question = session.current;

  return (
    <div className="w-full">
      <PracticeDashboard
        correct={session.correct}
        elapsedMs={stopwatch.elapsedMs}
        incorrect={session.incorrect}
        onFinish={finish}
        onReset={start}
        progress={{ done: session.solvedIds.size, total: session.total }}
        running={session.status === "running"}
      />

      {question ? (
        <ChoiceCard
          firstOptionRef={firstOptionRef}
          key={`${question.id}-${runId}`}
          names={names}
          onAnswer={answer}
          onSkip={session.queue.length > 0 ? skip : undefined}
          question={question}
          random={random}
        />
      ) : feedback && !showResults ? (
        <FinalAnswerReview onShowResults={() => setShowResults(true)}>
          <AnswerFeedback isCorrect={feedback.isCorrect} report={reportOf(feedback.question)}>
            <FeedbackDetail feedback={feedback} />
          </AnswerFeedback>
        </FinalAnswerReview>
      ) : (
        <PracticeSummary
          correct={session.correct}
          elapsedMs={stopwatch.elapsedMs}
          focusOnMount
          incorrect={session.incorrect}
          solved={session.solvedIds.size}
          solvedLabel="Zodpovězeno"
          total={session.total}
        >
          {missed.length > 0 ? <MissedList missed={missed} /> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill hover:bg-accent-strong"
              onClick={start}
              type="button"
            >
              Nový kvíz se stejným nastavením
            </button>
            <button
              className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
              onClick={() => {
                stopwatch.stop();
                setSession(null);
              }}
              type="button"
            >
              Změnit nastavení
            </button>
          </div>
        </PracticeSummary>
      )}

      <div aria-live="polite">
        {feedback && question ? (
          <AnswerFeedback isCorrect={feedback.isCorrect} report={reportOf(feedback.question)}>
            <FeedbackDetail feedback={feedback} />
          </AnswerFeedback>
        ) : null}
      </div>
    </div>
  );
}

/** Shuffles once per shown question, so a returning question has its options reordered. */
function useShuffled<Item>(items: readonly Item[], random: () => number): readonly Item[] {
  const [shuffled] = useState(() => drawSeries(items, items.length, random));
  return shuffled;
}

function ChoiceCard({
  question,
  names,
  onAnswer,
  onSkip,
  firstOptionRef,
  random,
}: Readonly<{
  question: ProductionChoiceQuestion;
  names: ReadonlyMap<string, string>;
  onAnswer: (optionId: string) => void;
  /** Absent when no other question is left to skip to. */
  onSkip: (() => void) | undefined;
  firstOptionRef: Ref<HTMLButtonElement>;
  random: () => number;
}>) {
  const headingId = useId();
  const options = useShuffled(question.options, random);
  const hint = reactionByproductHint(question.route, question.product.formula, names);
  return (
    <section
      aria-labelledby={headingId}
      className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-7"
      data-question-id={question.id}
    >
      <p className="text-center text-sm font-semibold text-ink-3">
        {ROUTE_KIND_LABELS[question.kind]}
      </p>
      <p className="mt-3 text-center font-display text-2xl leading-10 font-bold text-ink sm:text-3xl">
        <span className="sr-only">Výchozí látky: </span>
        <EquationTerms terms={question.route.reactants} /> <span aria-hidden="true">→ ?</span>
      </p>
      {question.route.conditionsCs ? (
        <p className="mt-2 text-center text-sm text-ink-2">
          Podmínky nad šipkou: {question.route.conditionsCs}
        </p>
      ) : null}
      <h2 className="mt-5 text-center text-lg font-semibold text-ink" id={headingId}>
        Které produkty touto reakcí vzniknou?
      </h2>
      <QuestionTools hint={<ByproductHintText hint={hint} />} onSkip={onSkip} />
      <ul
        aria-label="Možnosti odpovědi"
        className="mx-auto mt-4 grid max-w-xl list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2"
      >
        {options.map((option, index) => (
          <li key={option.id}>
            <button
              className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 text-left text-lg font-semibold text-ink hover:border-accent hover:bg-accent-soft"
              data-option-id={option.id}
              onClick={() => onAnswer(option.id)}
              ref={index === 0 ? firstOptionRef : undefined}
              type="button"
            >
              <span aria-hidden="true" className="shrink-0 text-base font-normal text-ink-2">
                {OPTION_LETTERS[index] ?? ""})
              </span>
              <span>
                <EquationSide
                  terms={option.formulas.map((formula) => ({ formula }))}
                  withCoefficients={false}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function reportOf(question: ProductionChoiceQuestion): ReportedQuestion {
  return {
    exercise: "Příprava a výroba",
    questionId: question.id,
    prompt: `${question.route.reactants.map((term) => term.formula).join(" + ")} → ? (${question.product.nameCs})`,
  };
}

function FeedbackDetail({ feedback }: Readonly<{ feedback: Feedback }>) {
  const { question, chosen, isCorrect } = feedback;
  return (
    <>
      {isCorrect ? null : (
        <p>
          Vaše odpověď:{" "}
          <EquationSide
            terms={chosen.formulas.map((formula) => ({ formula }))}
            withCoefficients={false}
          />
        </p>
      )}
      <p>
        Celá rovnice: <BalancedEquation route={question.route} />
      </p>
      <p className="text-ink-2">
        {KIND_LABELS[question.kind]}: <NamedSubstance {...question.product} />
      </p>
    </>
  );
}
