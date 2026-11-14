"use client";

import {
  type EquationRecallResult,
  gradeEquationRecall,
  gradeProductRecall,
  type ProductRecallResult,
  type RecallSideMatch,
} from "@inorganic/chemistry";
import type {
  PreparationProductionRuntimeProduct,
  PreparationProductionRuntimeRoute,
} from "@inorganic/content/preparation-production";
import { Fragment, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

import { Formula } from "@/components/formula";
import { CheckIcon, CrossIcon } from "@/components/icons";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import { NamedSubstance, QuestionTools } from "@/components/question-tools";
import { SegmentedChoice } from "@/components/segmented-choice";
import { czechCount } from "@/lib/czech-plural";
import { formulaNames, type ProductsHint, reactionByproductHint } from "@/lib/practice-hints";
import {
  answerPracticeQueue,
  createPracticeQueue,
  type PracticeQueueState,
  skipPracticeQueue,
} from "@/lib/practice-queue";
import type { ProductionQuizKind } from "@/lib/preparation-production-quiz";
import {
  countProductionRecallQuestions,
  createProductionRecall,
  type ProductionEquationQuestion,
  type ProductionProductsQuestion,
  type ProductionRecallMode,
  type ProductionRecallQuestion,
  type ProductionRecallSettings,
} from "@/lib/production-recall";

type Route = PreparationProductionRuntimeRoute;
type Term = Route["reactants"][number];

const QUESTION_FORMS = ["otázka", "otázky", "otázek"] as const;
const PRODUCT_FORMS = ["produkt", "produkty", "produktů"] as const;
const ROUTE_FORMS = ["ověřený postup", "ověřené postupy", "ověřených postupů"] as const;
const KINDS: readonly ProductionQuizKind[] = ["all", "preparation", "manufacture"];
const KIND_OPTIONS: readonly { readonly kind: ProductionQuizKind; readonly label: string }[] = [
  { kind: "all", label: "Vše" },
  { kind: "preparation", label: "Příprava" },
  { kind: "manufacture", label: "Výroba" },
];
const COUNT_OPTIONS: readonly { readonly value: number | null; readonly label: string }[] = [
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: null, label: "Všechny" },
];
const KIND_LABELS = { preparation: "Příprava", manufacture: "Výroba" } as const;
const ROUTE_KIND_LABELS = {
  preparation: "Laboratorní příprava",
  manufacture: "Průmyslová výroba",
} as const;

/** What the summary lists for a question whose first answer was not correct. */
interface MissedQuestion {
  readonly id: string;
  readonly kind: Route["kind"];
  readonly product: ProductionRecallQuestion["product"];
  readonly routes: readonly Route[];
}

function routesOf(question: ProductionRecallQuestion): readonly Route[] {
  return question.mode === "products" ? [question.route] : question.routes;
}

/**
 * Typed recall of preparation and production. Only the first check of a question is scored;
 * after a wrong check the learner may correct the answer or reveal the solution, and the
 * question then returns once at the end, as in the choice quiz. Coefficients are never
 * required: a correct answer is shown with the reviewed coefficients filled in.
 * Results stay in this session; the quiz does not record attempts.
 */
export function ProductionRecallQuiz({
  products,
  allowedSymbols,
  mode,
  settings,
  onSettingsChange,
  autoStart,
  onActiveChange,
  random,
}: Readonly<{
  products: readonly PreparationProductionRuntimeProduct[];
  allowedSymbols: readonly string[];
  mode: ProductionRecallMode;
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
        KINDS.map((kind) => [kind, countProductionRecallQuestions(products, kind, mode)]),
      ) as Record<ProductionQuizKind, number>,
    [products, mode],
  );
  const [session, setSession] = useState<PracticeQueueState<ProductionRecallQuestion> | null>(null);
  const [missed, setMissed] = useState<readonly MissedQuestion[]>([]);
  const [shown, setShown] = useState(0);
  const stopwatch = useStopwatch();
  const plannedCount = Math.min(
    settings.count ?? available[settings.kind],
    available[settings.kind],
  );

  const running = session?.status === "running";
  useEffect(() => onActiveChange(running), [running, onActiveChange]);

  function start() {
    setSession(
      createPracticeQueue(createProductionRecall(products, mode, settings, random), random),
    );
    setMissed([]);
    stopwatch.start();
    setShown((value) => value + 1);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the difficulty changed mid-quiz.
  useEffect(() => {
    if (autoStart) start();
  }, []);

  function finish() {
    stopwatch.stop();
    setSession((current) =>
      current ? { ...current, status: "finished", current: null, queue: [] } : current,
    );
  }

  function complete(isCorrect: boolean) {
    if (!session?.current) return;
    const question = session.current;
    const result = answerPracticeQueue(session, isCorrect);
    if (!result) return;
    setSession(result.state);
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
                routes: routesOf(question),
              },
            ],
      );
    }
    if (result.state.status === "finished") stopwatch.stop();
    setShown((value) => value + 1);
  }

  function skip() {
    if (!session?.current) return;
    setSession(skipPracticeQueue(session));
    setShown((value) => value + 1);
  }

  if (!session) {
    return (
      <RecallSetup
        available={available}
        mode={mode}
        onChange={onSettingsChange}
        onStart={start}
        plannedCount={plannedCount}
        settings={settings}
      />
    );
  }

  const question = session.current;
  const cardProps = {
    names,
    symbols,
    onComplete: complete,
    onSkip: session.queue.length > 0 ? skip : undefined,
  };

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
        question.mode === "products" ? (
          <ProductsCard {...cardProps} key={`${question.id}-${shown}`} question={question} />
        ) : (
          <EquationCard {...cardProps} key={`${question.id}-${shown}`} question={question} />
        )
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
    </div>
  );
}

function RecallSetup({
  mode,
  settings,
  available,
  plannedCount,
  onChange,
  onStart,
}: Readonly<{
  mode: ProductionRecallMode;
  settings: ProductionRecallSettings;
  available: Readonly<Record<ProductionQuizKind, number>>;
  plannedCount: number;
  onChange: (settings: ProductionRecallSettings) => void;
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
        {mode === "products"
          ? "U každé otázky uvidíte výchozí látky s koeficienty. Napište vzorce produktů oddělené znakem +, v libovolném pořadí a bez koeficientů. Po správné odpovědi se doplní celá vyčíslená rovnice."
          : "U každé otázky uvidíte jen látku a to, zda se připravuje v laboratoři, nebo vyrábí v průmyslu. Napište celou rovnici, například Zn + HCl -> ZnCl2 + H2. Koeficienty můžete vynechat; po správné odpovědi se doplní. Uznává se kterýkoli ověřený postup."}{" "}
        Vzorce pište s velkými a malými písmeny přesně (Co je kobalt, CO oxid uhelnatý). Hodnotí se
        první kontrola; po chybě můžete odpověď opravit nebo zobrazit řešení a otázka se jednou
        vrátí na konec. Výsledek se do pokroku zatím nezapočítává.
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
        options={COUNT_OPTIONS}
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
  readonly names: ReadonlyMap<string, string>;
  readonly symbols: ReadonlySet<string>;
  /** Called when the learner moves on; `isCorrect` is the result of the first check. */
  readonly onComplete: (isCorrect: boolean) => void;
  /** Absent when no other question is left to skip to. */
  readonly onSkip: (() => void) | undefined;
}

type CardStatus = "open" | "solved" | "revealed";

/**
 * The shared state of a typed question: the answer, the first-check result that is scored,
 * and whether the question is still open, solved or revealed.
 */
function useRecallCard<Result>(
  grade: (answer: string) => Result | null,
  isCorrect: (result: Result) => boolean,
) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [firstCorrect, setFirstCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<CardStatus>("open");
  const [unreadable, setUnreadable] = useState(false);

  function check() {
    if (status !== "open") return;
    const graded = grade(answer);
    if (graded === null) {
      setUnreadable(true);
      return;
    }
    setUnreadable(false);
    const correct = isCorrect(graded);
    setResult(graded);
    setFirstCorrect((current) => current ?? correct);
    if (correct) setStatus("solved");
  }

  return {
    answer,
    setAnswer: (value: string) => {
      setAnswer(value);
      setUnreadable(false);
    },
    result,
    firstCorrect,
    status,
    unreadable,
    check,
    reveal: () => {
      setFirstCorrect((current) => current ?? false);
      setStatus("revealed");
    },
  };
}

function ProductsCard({
  question,
  names,
  symbols,
  onComplete,
  onSkip,
}: CardProps<ProductionProductsQuestion>) {
  const headingId = useId();
  const card = useRecallCard<Extract<ProductRecallResult, { status: "graded" }>>(
    (answer) => {
      const graded = gradeProductRecall(answer, question.route.products, symbols);
      return graded.status === "graded" ? graded : null;
    },
    (graded) => graded.correct,
  );
  const hint = reactionByproductHint(question.route, question.product.formula, names);
  const done = card.status !== "open";
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
        {done ? (
          <BalancedEquation animate="products" route={question.route} />
        ) : (
          <>
            <span className="sr-only">Výchozí látky: </span>
            <EquationTerms terms={question.route.reactants} /> <span aria-hidden="true">→</span>{" "}
            <span aria-hidden="true">?</span>
          </>
        )}
      </p>
      {question.route.conditionsCs ? (
        <p className="mt-2 text-center text-sm text-ink-2">
          Podmínky nad šipkou: {question.route.conditionsCs}
        </p>
      ) : null}
      <h2 className="mt-5 text-center text-lg font-semibold text-ink" id={headingId}>
        Které produkty vzniknou?
      </h2>
      {done ? null : (
        <QuestionTools
          hint={<ByproductHintText hint={hint} />}
          onSkip={card.firstCorrect === null ? onSkip : undefined}
        />
      )}
      <AnswerForm
        disabled={done}
        label="Produkty (vzorce oddělte znakem +, bez koeficientů)"
        onChange={card.setAnswer}
        onSubmit={card.check}
        placeholder="např. ZnCl2 + H2"
        unreadable={card.unreadable}
        value={card.answer}
      />
      {card.status === "open" && card.result ? (
        <WrongAnswer onReveal={card.reveal}>
          <SideVerdicts match={card.result} />
          {card.result.missingCount > 0 ? (
            <p>
              {card.result.missingCount === 1 ? "Chybí ještě " : "Chybějí ještě "}
              {czechCount(card.result.missingCount, PRODUCT_FORMS)}.
            </p>
          ) : null}
        </WrongAnswer>
      ) : null}
      {done ? (
        <Outcome
          firstCorrect={card.firstCorrect === true}
          onContinue={() => onComplete(card.firstCorrect === true)}
          status={card.status}
        >
          <p>
            Celá rovnice: <BalancedEquation route={question.route} />
          </p>
          <p className="text-ink-2">
            {KIND_LABELS[question.kind]}: <NamedSubstance {...question.product} />
          </p>
        </Outcome>
      ) : null}
    </section>
  );
}

function EquationCard({
  question,
  symbols,
  onComplete,
  onSkip,
}: CardProps<ProductionEquationQuestion>) {
  const headingId = useId();
  const card = useRecallCard<Extract<EquationRecallResult<Route>, { status: "graded" }>>(
    (answer) => {
      const graded = gradeEquationRecall(answer, question.routes, symbols);
      return graded.status === "graded" ? graded : null;
    },
    (graded) => graded.correct,
  );
  const done = card.status !== "open";
  const solvedRoute = card.status === "solved" ? (card.result?.route ?? null) : null;
  const others = question.routes.filter((route) => route.id !== solvedRoute?.id);
  return (
    <section
      aria-labelledby={headingId}
      className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-7"
      data-question-id={question.id}
    >
      <p className="text-center text-sm font-semibold text-ink-3">
        {ROUTE_KIND_LABELS[question.kind]}
      </p>
      <h2
        className="mt-3 text-center font-display text-2xl leading-10 font-bold text-ink sm:text-3xl"
        id={headingId}
      >
        {question.kind === "preparation"
          ? "Jak se laboratorně připravuje "
          : "Jak se průmyslově vyrábí "}
        <NamedSubstance {...question.product} />?
      </h2>
      {question.routes.length > 1 ? (
        <p className="mt-2 text-center text-sm text-ink-2">
          V přehledu {question.routes.length < 5 ? "jsou" : "je"}{" "}
          {czechCount(question.routes.length, ROUTE_FORMS)}; uznává se kterýkoli z nich.
        </p>
      ) : null}
      {done ? null : (
        <StagedHints
          hints={[
            <>
              Výchozí látky: <EquationTerms terms={question.hintRoute.reactants} />
              {question.hintRoute.conditionsCs
                ? `; podmínky: ${question.hintRoute.conditionsCs}`
                : null}
            </>,
            <>
              Postup bez koeficientů:{" "}
              <EquationTerms terms={question.hintRoute.reactants} withCoefficients={false} /> →{" "}
              <EquationTerms terms={question.hintRoute.products} withCoefficients={false} />
            </>,
          ]}
          onSkip={card.firstCorrect === null ? onSkip : undefined}
        />
      )}
      <AnswerForm
        disabled={done}
        label="Rovnice (šipku napište jako -> nebo =)"
        onChange={card.setAnswer}
        onSubmit={card.check}
        placeholder="např. Zn + HCl -> ZnCl2 + H2"
        unreadable={card.unreadable}
        value={card.answer}
      />
      {card.status === "open" && card.result ? (
        <WrongAnswer onReveal={card.reveal}>
          <EquationMistake product={question.product} result={card.result} />
        </WrongAnswer>
      ) : null}
      {done ? (
        <Outcome
          firstCorrect={card.firstCorrect === true}
          onContinue={() => onComplete(card.firstCorrect === true)}
          status={card.status}
        >
          {solvedRoute ? (
            <p>
              Vyčíslená rovnice: <BalancedEquation animate="all" route={solvedRoute} />
              <Conditions route={solvedRoute} />
            </p>
          ) : null}
          {others.length > 0 ? (
            <div>
              <p className="font-semibold">
                {solvedRoute ? "Další ověřené postupy:" : "Ověřené postupy:"}
              </p>
              <ul className="mt-1 grid list-none gap-1 p-0">
                {others.map((route) => (
                  <li key={route.id}>
                    <BalancedEquation route={route} />
                    <Conditions route={route} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Outcome>
      ) : null}
    </section>
  );
}

function EquationMistake({
  result,
  product,
}: Readonly<{
  result: Extract<EquationRecallResult<Route>, { status: "graded" }>;
  product: ProductionRecallQuestion["product"];
}>) {
  if (result.route && result.coefficients) {
    const reason = {
      unbalanced: "Látky jsou správně, ale koeficienty rovnici nevyčíslují.",
      unreduced:
        "Látky jsou správně a počty atomů souhlasí, ale koeficienty nejsou v nejmenším celočíselném poměru.",
      different: "Látky jsou správně, ale ověřená rovnice má jiné koeficienty.",
      omitted: null,
      matched: null,
    }[result.coefficients];
    return <p>{reason} Koeficienty můžete také vynechat; po správné odpovědi se doplní.</p>;
  }
  return (
    <>
      <p>
        Tato reakce není mezi ověřenými postupy pro látku <NamedSubstance {...product} />. Ve
        srovnání s nejbližším z nich:
      </p>
      <p>
        Výchozí látky: <SideVerdicts inline match={result.reactants} />
        {result.reactants.missingCount > 0 ? ` (chybí ${result.reactants.missingCount})` : null}
      </p>
      <p>
        Produkty: <SideVerdicts inline match={result.products} />
        {result.products.missingCount > 0 ? ` (chybí ${result.products.missingCount})` : null}
      </p>
    </>
  );
}

function AnswerForm({
  label,
  placeholder,
  value,
  disabled,
  unreadable,
  onChange,
  onSubmit,
}: Readonly<{
  label: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  unreadable: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  useEffect(() => inputRef.current?.focus(), []);
  return (
    <form
      className="mt-5 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="grid gap-2 font-medium text-ink">
        {label}
        <input
          aria-describedby={unreadable ? errorId : undefined}
          aria-invalid={unreadable || undefined}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="min-h-12 w-full rounded-xl border border-line-strong bg-surface px-3 font-mono text-ink disabled:bg-surface-2"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          ref={inputRef}
          spellCheck={false}
          value={value}
        />
      </label>
      <p
        aria-hidden="true"
        className="min-h-8 text-lg leading-8 text-ink"
        data-testid="answer-preview"
      >
        <TypedPreview value={value} />
      </p>
      {unreadable ? (
        <p className="text-sm text-bad" id={errorId} role="alert">
          Zápis nelze přečíst. Vzorce oddělte znakem +, u celé rovnice napište jednu šipku (-&gt;
          nebo =).
        </p>
      ) : null}
      {disabled ? null : (
        <div>
          <button
            className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-3"
            disabled={value.trim() === ""}
            type="submit"
          >
            Zkontrolovat
          </button>
        </div>
      )}
    </form>
  );
}

function WrongAnswer({
  children,
  onReveal,
}: Readonly<{ children: ReactNode; onReveal: () => void }>) {
  return (
    <div
      aria-live="polite"
      className="mt-4 rounded-2xl border border-bad/40 bg-bad-soft p-4 sm:p-5"
      role="status"
    >
      <p className="flex items-center gap-2 font-bold text-bad">
        <CrossIcon />
        Zatím ne
      </p>
      <div className="mt-1 grid gap-1 leading-7 text-ink">{children}</div>
      <p className="mt-2 text-sm text-ink-2">Opravte odpověď a zkontrolujte ji znovu, nebo:</p>
      <button
        className="mt-2 min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-surface-3"
        onClick={onReveal}
        type="button"
      >
        Ukázat řešení
      </button>
    </div>
  );
}

function Outcome({
  status,
  firstCorrect,
  onContinue,
  children,
}: Readonly<{
  status: CardStatus;
  firstCorrect: boolean;
  onContinue: () => void;
  children: ReactNode;
}>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => buttonRef.current?.focus(), []);
  const solved = status === "solved";
  return (
    <div
      aria-live="polite"
      className={`mt-4 rounded-2xl border p-4 sm:p-5 ${
        firstCorrect ? "border-good/40 bg-good-soft" : "border-bad/40 bg-bad-soft"
      }`}
      role="status"
    >
      <p className={`flex items-center gap-2 font-bold ${firstCorrect ? "text-good" : "text-bad"}`}>
        {firstCorrect ? <CheckIcon /> : <CrossIcon />}
        {firstCorrect ? "Správně" : solved ? "Správně po opravě; počítá se první pokus" : "Řešení"}
      </p>
      <div className="mt-1 grid gap-2 leading-7 text-ink">{children}</div>
      <button
        className="mt-4 min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill hover:bg-accent-strong"
        onClick={onContinue}
        ref={buttonRef}
        type="button"
      >
        Pokračovat
      </button>
    </div>
  );
}

const VERDICT_TEXT = {
  correct: "správně",
  duplicate: "uvedeno dvakrát",
  wrong: "nepatří sem",
} as const;

function SideVerdicts({
  match,
  inline = false,
}: Readonly<{ match: RecallSideMatch; inline?: boolean }>) {
  const items = match.terms.map((term, index) => (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 ${
        term.verdict === "correct" ? "bg-good-soft text-good" : "bg-surface text-bad"
      }`}
      // biome-ignore lint/suspicious/noArrayIndexKey: typed terms may repeat; the position identifies them.
      key={`${index}-${term.formula}`}
    >
      {term.verdict === "correct" ? <CheckIcon /> : <CrossIcon />}
      <Formula formula={term.formula} />
      <span className="text-sm">{VERDICT_TEXT[term.verdict]}</span>
    </span>
  ));
  return inline ? (
    <span className="inline-flex flex-wrap gap-1">{items}</span>
  ) : (
    <p className="flex flex-wrap gap-1">{items}</p>
  );
}

function ByproductHintText({ hint }: Readonly<{ hint: ProductsHint }>) {
  if (hint.productCount <= 1) return <>Vzniká jediný produkt.</>;
  return (
    <>
      Vznikají {czechCount(hint.productCount, PRODUCT_FORMS)}.
      {hint.product ? (
        <>
          {" "}
          Jedním z nich je <NamedSubstance {...hint.product} />.
        </>
      ) : null}
    </>
  );
}

/** „Nápověda“ opens the hints one at a time; „Přeskočit“ moves the question to the end. */
function StagedHints({
  hints,
  onSkip,
}: Readonly<{ hints: readonly ReactNode[]; onSkip: (() => void) | undefined }>) {
  const [opened, setOpened] = useState(0);
  const listId = useId();
  return (
    <div className="mt-3">
      <div className="flex flex-wrap justify-center gap-2">
        {opened < hints.length ? (
          <button
            aria-controls={listId}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-3"
            onClick={() => setOpened((value) => value + 1)}
            type="button"
          >
            {opened === 0 ? "Nápověda" : "Další nápověda"}
          </button>
        ) : null}
        {onSkip ? (
          <button
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-3"
            onClick={onSkip}
            type="button"
          >
            Přeskočit
          </button>
        ) : null}
      </div>
      <ol className="mt-3 grid list-none gap-2 p-0" id={listId}>
        {hints.slice(0, opened).map((hint, index) => (
          <li
            className="rounded-xl bg-surface-2 p-3 text-center text-sm leading-6 text-ink"
            // biome-ignore lint/suspicious/noArrayIndexKey: hints are fixed per question and only appended.
            key={index}
          >
            {hint}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One side of a reaction; coefficients of 1 are left out. */
function EquationTerms({
  terms,
  withCoefficients = true,
  animate = false,
}: Readonly<{ terms: readonly Term[]; withCoefficients?: boolean; animate?: boolean }>) {
  return (
    <>
      {terms.map((term, index) => (
        // A formula appears once per side of an equation, so it identifies the term.
        <Fragment key={term.formula}>
          {index > 0 ? " + " : null}
          {withCoefficients && term.coefficient !== 1 ? (
            <>
              <span
                className={animate ? "reaction-coefficient-active text-accent" : undefined}
                data-coefficient=""
              >
                {term.coefficient}
              </span>{" "}
            </>
          ) : null}
          <Formula formula={term.formula} />
        </Fragment>
      ))}
    </>
  );
}

/** The reviewed, balanced reaction; the coefficients filled in for the learner are highlighted. */
function BalancedEquation({
  route,
  animate = "none",
}: Readonly<{ route: Route; animate?: "none" | "products" | "all" }>) {
  return (
    <span data-balanced-equation="">
      <EquationTerms animate={animate === "all"} terms={route.reactants} /> →{" "}
      <EquationTerms animate={animate !== "none"} terms={route.products} />
    </span>
  );
}

function Conditions({ route }: Readonly<{ route: Route }>) {
  return route.conditionsCs ? (
    <span className="text-ink-2">; podmínky: {route.conditionsCs}</span>
  ) : null;
}

const SUBSCRIPT_DIGITS = /[₀-₉]/gu;
const TYPED_TERM = /^(\d*)\s*([A-Za-z0-9()[\]]+)$/u;

/** Live typeset preview of what the learner types, so H2SO4 reads as H₂SO₄. */
function TypedPreview({ value }: Readonly<{ value: string }>) {
  const plain = value.replace(SUBSCRIPT_DIGITS, (digit) =>
    String(digit.charCodeAt(0) - "₀".charCodeAt(0)),
  );
  const sides = plain.split(/->|→|⟶|=>?/u);
  return (
    <>
      {sides.map((side, sideIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the sides of a typed equation are positional.
        <Fragment key={sideIndex}>
          {sideIndex > 0 ? " → " : null}
          {side
            .split(/[+,]/u)
            .map((piece) => piece.trim())
            .filter((piece) => piece !== "")
            .map((piece, index) => {
              const match = TYPED_TERM.exec(piece);
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: typed terms are positional.
                <Fragment key={`${index}-${piece}`}>
                  {index > 0 ? " + " : null}
                  {match ? (
                    <>
                      {match[1] ? `${match[1]} ` : null}
                      <Formula formula={match[2] ?? ""} />
                    </>
                  ) : (
                    piece
                  )}
                </Fragment>
              );
            })}
        </Fragment>
      ))}
    </>
  );
}

function MissedList({ missed }: Readonly<{ missed: readonly MissedQuestion[] }>) {
  return (
    <section className="mt-5 border-t border-line pt-4">
      <h3 className="font-semibold text-ink">K zopakování</h3>
      <ul className="mt-2 grid list-none gap-2 p-0">
        {missed.map((item) => (
          <li className="rounded-xl bg-surface-2 p-3 text-sm leading-6" key={item.id}>
            <span className="font-semibold text-ink">
              {item.product.nameCs} (<Formula formula={item.product.formula} />)
            </span>{" "}
            <span className="text-ink-3">· {KIND_LABELS[item.kind]}</span>
            {item.routes.map((route) => (
              <span className="block text-ink-2" key={route.id}>
                <BalancedEquation route={route} />
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
