"use client";

import type { PreparationProductionRuntimeProduct } from "@inorganic/content/preparation-production";
import { type ReactNode, type Ref, useEffect, useId, useMemo, useRef, useState } from "react";

import { AnswerFeedback } from "@/components/answer-feedback";
import { FinalAnswerReview } from "@/components/final-answer-review";
import { Equation, EquationSide, Formula } from "@/components/formula";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import { ProductionRecallQuiz } from "@/components/production-recall-quiz";
import { NamedSubstance, QuestionTools } from "@/components/question-tools";
import { SegmentedChoice } from "@/components/segmented-choice";
import { czechCount } from "@/lib/czech-plural";
import { drawSeries } from "@/lib/periodic-table-scope";
import {
  formulaNames,
  type RouteHint,
  routeReactantHint,
  substanceElementsHint,
} from "@/lib/practice-hints";
import {
  answerPracticeQueue,
  createPracticeQueue,
  type PracticeQueueState,
  skipPracticeQueue,
} from "@/lib/practice-queue";
import {
  countProductionQuizQuestions,
  createProductionQuiz,
  isProductionQuizAnswerCorrect,
  type ProductionQuizDirection,
  type ProductionQuizItem,
  type ProductionQuizKind,
  type ProductionQuizOption,
  type ProductionQuizQuestion,
  type ProductionQuizSettings,
  type ProductionRouteOption,
  type ProductionRouteQuestion,
} from "@/lib/preparation-production-quiz";
import {
  loadProductionQuizMode,
  type ProductionQuizMode,
  saveProductionQuizMode,
} from "@/lib/production-quiz-preferences";

const QUESTION_FORMS = ["otázka", "otázky", "otázek"] as const;
const KIND_OPTIONS: readonly { readonly kind: ProductionQuizKind; readonly label: string }[] = [
  { kind: "all", label: "Vše" },
  { kind: "preparation", label: "Příprava" },
  { kind: "manufacture", label: "Výroba" },
];
const COUNT_OPTIONS: readonly { readonly count: number | null; readonly label: string }[] = [
  { count: 10, label: "10" },
  { count: 20, label: "20" },
  { count: null, label: "Všechny" },
];
const DIRECTION_OPTIONS: readonly {
  readonly direction: ProductionQuizDirection;
  readonly label: string;
}[] = [
  { direction: "choose-route", label: "Jak látku získat" },
  { direction: "identify-product", label: "Co vzniká" },
];
const KIND_LABELS = { preparation: "Příprava", manufacture: "Výroba" } as const;
const ROUTE_KIND_LABELS = {
  preparation: "Laboratorní příprava",
  manufacture: "Průmyslová výroba",
} as const;
const OPTION_LETTERS = ["a", "b", "c", "d"] as const;
const KINDS: readonly ProductionQuizKind[] = ["all", "preparation", "manufacture"];

type Feedback =
  | {
      readonly question: ProductionQuizQuestion;
      readonly chosen: ProductionQuizOption;
      readonly isCorrect: boolean;
    }
  | {
      readonly question: ProductionRouteQuestion;
      readonly chosen: ProductionRouteOption;
      readonly isCorrect: boolean;
    };

const MODE_OPTIONS: readonly { readonly value: ProductionQuizMode; readonly label: string }[] = [
  { value: "easy", label: "Lehká" },
  { value: "advanced", label: "Pokročilá" },
  { value: "pro", label: "Pro" },
];

/**
 * The preparation and production quiz in three difficulties: „Lehká“ is the multiple-choice
 * quiz, „Pokročilá“ asks for the typed products of given reactants and „Pro“ for a whole typed
 * reaction. The chosen difficulty is remembered on this device. Switching it during a quiz
 * starts a new quiz in the chosen difficulty with the same kind and number of questions.
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
  const [settings, setSettings] = useState<ProductionQuizSettings>({
    kind: "all",
    count: 10,
    direction: "choose-route",
  });
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
          onSettingsChange={(next) => setSettings({ ...settings, ...next })}
          products={products}
          random={random}
          settings={settings}
        />
      )}
    </div>
  );
}

/**
 * Multiple-choice recall of preparation and industrial production, in two directions: the
 * learner picks the reactants that make a given substance, or the substance that a given
 * route makes. Options are shuffled each time a question is shown.
 * Results stay in this session; the quiz does not record attempts.
 */
function ChoiceProductionQuiz({
  products,
  settings,
  onSettingsChange: setSettings,
  autoStart,
  onActiveChange,
  random,
}: Readonly<{
  products: readonly PreparationProductionRuntimeProduct[];
  settings: ProductionQuizSettings;
  onSettingsChange: (settings: ProductionQuizSettings) => void;
  /** Starts a quiz on mounting, after the difficulty was switched during a quiz. */
  autoStart: boolean;
  onActiveChange: (active: boolean) => void;
  random: () => number;
}>) {
  const [session, setSession] = useState<PracticeQueueState<ProductionQuizItem> | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [missed, setMissed] = useState<readonly Feedback[]>([]);
  const [runId, setRunId] = useState(0);
  const stopwatch = useStopwatch();
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  const direction = settings.direction ?? "identify-product";
  const availableByDirection = useMemo(() => {
    const count = (target: ProductionQuizDirection) =>
      Object.fromEntries(
        KINDS.map((kind) => [kind, countProductionQuizQuestions(products, kind, target)]),
      ) as Record<ProductionQuizKind, number>;
    return { "choose-route": count("choose-route"), "identify-product": count("identify-product") };
  }, [products]);
  const names = useMemo(() => formulaNames(products), [products]);
  const availableByKind = availableByDirection[direction];
  const available = availableByKind[settings.kind];
  const plannedCount = Math.min(settings.count ?? available, available);

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
    setSession(createPracticeQueue(createProductionQuiz(products, settings, random), random));
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
    const isCorrect = isProductionQuizAnswerCorrect(question, optionId);
    const result = answerPracticeQueue(session, isCorrect);
    if (!result) return;
    let entry: Feedback;
    if (question.direction === "choose-route") {
      const chosen = question.options.find((option) => option.id === optionId);
      if (!chosen) return;
      entry = { question, chosen, isCorrect };
    } else {
      const chosen = question.options.find((option) => option.id === optionId);
      if (!chosen) return;
      entry = { question, chosen, isCorrect };
    }
    setSession(result.state);
    setFeedback(entry);
    if (!isCorrect) {
      setMissed((previous) =>
        previous.some((item) => item.question.id === question.id) ? previous : [...previous, entry],
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
        available={availableByKind}
        onChange={setSettings}
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
        <QuestionCard
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
          <AnswerFeedback isCorrect={feedback.isCorrect}>
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
          <AnswerFeedback isCorrect={feedback.isCorrect}>
            <FeedbackDetail feedback={feedback} />
          </AnswerFeedback>
        ) : null}
      </div>
    </div>
  );
}

function QuizSetup({
  settings,
  available,
  plannedCount,
  onChange,
  onStart,
}: Readonly<{
  settings: ProductionQuizSettings;
  available: Readonly<Record<ProductionQuizKind, number>>;
  plannedCount: number;
  onChange: (settings: ProductionQuizSettings) => void;
  onStart: () => void;
}>) {
  const directionName = useId();
  const kindName = useId();
  const countName = useId();
  return (
    <section
      aria-label="Nastavení kvízu"
      className="grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <p className="leading-7 text-ink-2">
        {settings.direction === "choose-route"
          ? "U každé otázky uvidíte látku, kterou je třeba připravit nebo vyrobit. Vyberte výchozí látky a podmínky, které k ní vedou."
          : "U každé otázky uvidíte výchozí látky a podmínky reakce. Vyberte, která látka takto vzniká."}{" "}
        Možnosti a otázky jsou pokaždé v jiném pořadí. Chybně zodpovězená otázka se jednou vrátí na
        konec. Výsledek se zobrazí na konci kvízu; do pokroku se zatím nezapočítává.
      </p>
      <SegmentedChoice
        legend="Typ otázky"
        name={directionName}
        onSelect={(direction) => onChange({ ...settings, direction })}
        options={DIRECTION_OPTIONS.map(({ direction, label }) => ({ value: direction, label }))}
        value={settings.direction ?? "identify-product"}
      />
      <SegmentedChoice
        legend="Postupy"
        name={kindName}
        onSelect={(kind) => onChange({ ...settings, kind })}
        options={KIND_OPTIONS.map(({ kind, label }) => ({
          value: kind,
          label: `${label} (${available[kind]})`,
        }))}
        value={settings.kind}
      />
      <SegmentedChoice
        legend="Počet otázek"
        name={countName}
        onSelect={(count) => onChange({ ...settings, count })}
        options={COUNT_OPTIONS.map(({ count, label }) => ({ value: count, label }))}
        value={settings.count}
      />
      <div>
        <button
          className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-on-fill hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-3"
          disabled={plannedCount === 0}
          onClick={onStart}
          type="button"
        >
          Spustit kvíz ({czechCount(plannedCount, QUESTION_FORMS)})
        </button>
      </div>
    </section>
  );
}

interface CardProps<Question> {
  readonly question: Question;
  readonly onAnswer: (optionId: string) => void;
  /** Absent when no other question is left to skip to. */
  readonly onSkip: (() => void) | undefined;
  readonly firstOptionRef: Ref<HTMLButtonElement>;
  readonly random: () => number;
  readonly names: ReadonlyMap<string, string>;
}

function QuestionCard(props: CardProps<ProductionQuizItem>) {
  const { question } = props;
  return question.direction === "choose-route" ? (
    <RouteQuestionCard {...props} question={question} />
  ) : (
    <ProductQuestionCard {...props} question={question} />
  );
}

/** Shuffles once per shown question, so a returning question has its options reordered. */
function useShuffled<Item>(items: readonly Item[], random: () => number): readonly Item[] {
  const [shuffled] = useState(() => drawSeries(items, items.length, random));
  return shuffled;
}

function OptionButton({
  index,
  onClick,
  buttonRef,
  children,
}: Readonly<{
  index: number;
  onClick: () => void;
  buttonRef: Ref<HTMLButtonElement> | undefined;
  children: ReactNode;
}>) {
  return (
    <button
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line-strong bg-surface px-4 py-2 text-left font-semibold text-ink hover:border-accent hover:bg-accent-soft"
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      <span aria-hidden="true" className="shrink-0 font-normal text-ink-2">
        {OPTION_LETTERS[index] ?? ""})
      </span>
      {children}
    </button>
  );
}

function ProductQuestionCard({
  question,
  onAnswer,
  onSkip,
  firstOptionRef,
  random,
}: CardProps<ProductionQuizQuestion>) {
  const elements = substanceElementsHint(question.answer.formula);
  const headingId = useId();
  const options = useShuffled(question.options, random);
  const verb = question.kind === "preparation" ? "připravit" : "vyrobit";
  return (
    <section
      aria-labelledby={headingId}
      className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-7"
    >
      <p className="text-center text-sm font-semibold text-ink-3">{KIND_LABELS[question.kind]}</p>
      <p className="mt-3 text-center font-display text-2xl leading-10 font-bold text-ink sm:text-3xl">
        <span className="sr-only">Výchozí látky: </span>
        <EquationSide terms={question.route.reactants} /> <span aria-hidden="true">→</span>{" "}
        <span aria-hidden="true">?</span>
      </p>
      {question.route.conditionsCs ? (
        <p className="mt-2 text-center text-sm text-ink-2">
          Podmínky nad šipkou: {question.route.conditionsCs}
        </p>
      ) : null}
      <h2 className="mt-5 text-center text-lg font-semibold text-ink" id={headingId}>
        Kterou látku lze takto {verb}?
      </h2>
      <QuestionTools
        hint={elements.length > 0 ? `Hledaná látka obsahuje prvky: ${elements.join(", ")}.` : null}
        onSkip={onSkip}
      />
      <ul aria-label="Možnosti odpovědi" className="mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
        {options.map((option, index) => (
          <li key={option.id}>
            <OptionButton
              buttonRef={index === 0 ? firstOptionRef : undefined}
              index={index}
              onClick={() => onAnswer(option.id)}
            >
              <span className="flex flex-1 items-center justify-between gap-3">
                <span data-option-name="">{option.nameCs}</span>
                <span className="font-normal text-ink-2">
                  <Formula formula={option.formula} />
                </span>
              </span>
            </OptionButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RouteQuestionCard({
  question,
  onAnswer,
  onSkip,
  firstOptionRef,
  random,
  names,
}: CardProps<ProductionRouteQuestion>) {
  const reactant = routeReactantHint(question, names);
  const headingId = useId();
  const options = useShuffled(question.options, random);
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
        <span aria-hidden="true">?</span> <span aria-hidden="true">→</span>{" "}
        <span className="sr-only">Hledaná látka: </span>
        {question.product.nameCs} (<Formula formula={question.product.formula} />)
      </p>
      <h2 className="mt-5 text-center text-lg font-semibold text-ink" id={headingId}>
        {question.kind === "preparation"
          ? "Ze kterých výchozích látek tuto látku laboratorně připravíme?"
          : "Ze kterých výchozích látek se tato látka průmyslově vyrábí?"}
      </h2>
      <QuestionTools hint={<RouteHintText hint={reactant} />} onSkip={onSkip} />
      <ul aria-label="Možnosti odpovědi" className="mt-4 grid list-none gap-2 p-0">
        {options.map((option, index) => (
          <li key={option.id}>
            <OptionButton
              buttonRef={index === 0 ? firstOptionRef : undefined}
              index={index}
              onClick={() => onAnswer(option.id)}
            >
              <RouteReactants route={option.route} />
            </OptionButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

const REACTANT_FORMS = ["výchozí látka", "výchozí látky", "výchozích látek"] as const;

function RouteHintText({ hint }: Readonly<{ hint: RouteHint }>) {
  return hint.kind === "reactant" ? (
    <>
      Jednou z výchozích látek je <NamedSubstance {...hint.reactant} />.
    </>
  ) : (
    <>Správný postup má {czechCount(hint.reactantCount, REACTANT_FORMS)}.</>
  );
}

function RouteReactants({ route }: Readonly<{ route: ProductionRouteOption["route"] }>) {
  return (
    <span className="grid gap-0.5">
      <span>
        <EquationSide terms={route.reactants} withCoefficients={false} />
      </span>
      {route.conditionsCs ? (
        <span className="text-sm font-normal text-ink-2">Podmínky: {route.conditionsCs}</span>
      ) : null}
    </span>
  );
}

function RouteLine({ route }: Readonly<{ route: ProductionRouteOption["route"] }>) {
  return (
    <>
      <Equation products={route.products} reactants={route.reactants} />
      {route.conditionsCs ? `; podmínky: ${route.conditionsCs}` : null}
    </>
  );
}

function FeedbackDetail({ feedback }: Readonly<{ feedback: Feedback }>) {
  if (feedback.question.direction === "choose-route") {
    const { question, chosen, isCorrect } = feedback as Extract<
      Feedback,
      { question: ProductionRouteQuestion }
    >;
    return (
      <>
        {isCorrect ? null : (
          <p>
            Vaše odpověď: <RouteLine route={chosen.route} />
          </p>
        )}
        <p>
          Správný postup: <RouteLine route={question.route} />
        </p>
      </>
    );
  }
  const { question, chosen, isCorrect } = feedback as Extract<
    Feedback,
    { question: ProductionQuizQuestion }
  >;
  return (
    <>
      {isCorrect ? null : (
        <p>
          Vaše odpověď: {chosen.nameCs} (<Formula formula={chosen.formula} />)
        </p>
      )}
      <p>
        Hledaná látka: {question.answer.nameCs} (<Formula formula={question.answer.formula} />)
      </p>
      <p className="text-ink-2">
        <RouteLine route={question.route} />
      </p>
    </>
  );
}

function MissedList({ missed }: Readonly<{ missed: readonly Feedback[] }>) {
  return (
    <section className="mt-5 border-t border-line pt-4">
      <h3 className="font-semibold text-ink">K zopakování</h3>
      <ul className="mt-2 grid list-none gap-2 p-0">
        {missed.map(({ question }) => {
          const target = question.direction === "choose-route" ? question.product : question.answer;
          return (
            <li className="rounded-xl bg-surface-2 p-3 text-sm leading-6" key={question.id}>
              <span className="font-semibold text-ink">
                {target.nameCs} (<Formula formula={target.formula} />)
              </span>{" "}
              <span className="text-ink-3">· {KIND_LABELS[question.kind]}</span>
              <span className="block text-ink-2">
                <Equation products={question.route.products} reactants={question.route.reactants} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
