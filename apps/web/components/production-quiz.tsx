"use client";

import type { PreparationProductionRuntimeProduct } from "@inorganic/content/preparation-production";
import { type Ref, useEffect, useId, useMemo, useRef, useState } from "react";

import { AnswerFeedback } from "@/components/answer-feedback";
import { Equation, EquationSide, Formula } from "@/components/formula";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import { czechCount } from "@/lib/czech-plural";
import {
  createProductionQuiz,
  isProductionQuizAnswerCorrect,
  listProductionQuizRoutes,
  type ProductionQuizKind,
  type ProductionQuizOption,
  type ProductionQuizQuestion,
  type ProductionQuizSettings,
} from "@/lib/preparation-production-quiz";
import {
  answerPracticeQueue,
  createPracticeQueue,
  type PracticeQueueState,
} from "@/lib/practice-queue";

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
const KIND_LABELS = { preparation: "Příprava", manufacture: "Výroba" } as const;

interface Feedback {
  readonly question: ProductionQuizQuestion;
  readonly chosen: ProductionQuizOption;
  readonly isCorrect: boolean;
}

/**
 * Multiple-choice recall of preparation and industrial production: the reactants and
 * conditions of a reviewed route are shown, the learner picks the substance it makes.
 * Results stay in this session; the quiz does not record attempts.
 */
export function ProductionQuiz({
  products,
  random = Math.random,
}: Readonly<{
  products: readonly PreparationProductionRuntimeProduct[];
  random?: () => number;
}>) {
  const [settings, setSettings] = useState<ProductionQuizSettings>({ kind: "all", count: 10 });
  const [session, setSession] = useState<PracticeQueueState<ProductionQuizQuestion> | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [missed, setMissed] = useState<readonly Feedback[]>([]);
  const [runId, setRunId] = useState(0);
  const stopwatch = useStopwatch();
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  const availableByKind = useMemo(
    (): Readonly<Record<ProductionQuizKind, number>> => ({
      all: listProductionQuizRoutes(products, "all").length,
      preparation: listProductionQuizRoutes(products, "preparation").length,
      manufacture: listProductionQuizRoutes(products, "manufacture").length,
    }),
    [products],
  );
  const available = availableByKind[settings.kind];
  const plannedCount = Math.min(settings.count ?? available, available);

  // Keeps the keyboard on the options after each answer; the old buttons are replaced.
  useEffect(() => {
    if (runId > 0) firstOptionRef.current?.focus();
  }, [runId]);

  function start() {
    setSession(createPracticeQueue(createProductionQuiz(products, settings, random), random));
    setFeedback(null);
    setMissed([]);
    stopwatch.start();
    setRunId((value) => value + 1);
  }

  function finish() {
    stopwatch.stop();
    setSession((current) =>
      current ? { ...current, status: "finished", current: null, queue: [] } : current,
    );
  }

  function answer(option: ProductionQuizOption) {
    if (!session?.current) return;
    const question = session.current;
    const isCorrect = isProductionQuizAnswerCorrect(question, option.id);
    const result = answerPracticeQueue(session, isCorrect);
    if (!result) return;
    const entry = { question, chosen: option, isCorrect };
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
          onAnswer={answer}
          question={question}
        />
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
        {feedback ? (
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
  const kindName = useId();
  const countName = useId();
  return (
    <section
      aria-label="Nastavení kvízu"
      className="grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <p className="leading-7 text-ink-2">
        U každé otázky uvidíte výchozí látky a podmínky reakce. Vyberte, která látka takto vzniká.
        Chybně zodpovězená otázka se jednou vrátí na konec. Výsledek se zobrazí na konci kvízu; do
        pokroku se zatím nezapočítává.
      </p>
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

function SegmentedChoice<Value extends string | number | null>({
  legend,
  name,
  options,
  value,
  onSelect,
}: Readonly<{
  legend: string;
  name: string;
  options: readonly { readonly value: Value; readonly label: string }[];
  value: Value;
  onSelect: (value: Value) => void;
}>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink-2">{legend}</legend>
      <div className="inline-flex flex-wrap rounded-xl border border-line-strong bg-surface-3 p-1">
        {options.map((option) => (
          <label key={String(option.value)}>
            <input
              checked={value === option.value}
              className="peer sr-only"
              name={name}
              onChange={() => onSelect(option.value)}
              type="radio"
              value={String(option.value)}
            />
            <span className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-4 text-sm font-semibold text-ink-2 peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
              {value === option.value ? <span aria-hidden="true">✓</span> : null}
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function QuestionCard({
  question,
  onAnswer,
  firstOptionRef,
}: Readonly<{
  question: ProductionQuizQuestion;
  onAnswer: (option: ProductionQuizOption) => void;
  firstOptionRef: Ref<HTMLButtonElement>;
}>) {
  const headingId = useId();
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
      <ul className="mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
        {question.options.map((option, index) => (
          <li key={option.id}>
            <button
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-4 py-2 text-left font-semibold text-ink hover:border-accent hover:bg-accent-soft"
              onClick={() => onAnswer(option)}
              ref={index === 0 ? firstOptionRef : undefined}
              type="button"
            >
              <span>{option.nameCs}</span>
              <span className="font-normal text-ink-2">
                <Formula formula={option.formula} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeedbackDetail({ feedback }: Readonly<{ feedback: Feedback }>) {
  const { question, chosen, isCorrect } = feedback;
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
        <Equation products={question.route.products} reactants={question.route.reactants} />
        {question.route.conditionsCs ? `; podmínky: ${question.route.conditionsCs}` : null}
      </p>
    </>
  );
}

function MissedList({ missed }: Readonly<{ missed: readonly Feedback[] }>) {
  return (
    <section className="mt-5 border-t border-line pt-4">
      <h3 className="font-semibold text-ink">K zopakování</h3>
      <ul className="mt-2 grid list-none gap-2 p-0">
        {missed.map(({ question }) => (
          <li className="rounded-xl bg-surface-2 p-3 text-sm leading-6" key={question.id}>
            <span className="font-semibold text-ink">
              {question.answer.nameCs} (<Formula formula={question.answer.formula} />)
            </span>{" "}
            <span className="text-ink-3">· {KIND_LABELS[question.kind]}</span>
            <span className="block text-ink-2">
              <Equation products={question.route.products} reactants={question.route.reactants} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
