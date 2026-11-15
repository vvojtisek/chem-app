"use client";

import {
  gradeProductSlots,
  gradeRouteSlots,
  type ProductSlotsResult,
  type RecallTerm,
  type RouteSlotsResult,
  type SlotSideResult,
} from "@inorganic/chemistry";
import type { PreparationProductionRuntimeProduct } from "@inorganic/content/preparation-production";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Formula } from "@/components/formula";
import { CheckIcon, CrossIcon } from "@/components/icons";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import {
  BalancedEquation,
  ByproductHintText,
  Coefficient,
  Conditions,
  EquationTerms,
  KIND_LABELS,
  KINDS,
  MissedList,
  type MissedQuestion,
  PRODUCT_FORMS,
  QuizSetup,
  ROUTE_KIND_LABELS,
  type Route,
} from "@/components/production-quiz-parts";
import { NamedSubstance, QuestionTools } from "@/components/question-tools";
import { czechCount } from "@/lib/czech-plural";
import { formulaNames, reactionByproductHint } from "@/lib/practice-hints";
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

const ROUTE_FORMS = ["ověřený postup", "ověřené postupy", "ověřených postupů"] as const;
const MAX_SLOTS = 6;
const COMMON_RULES =
  "Vzorce pište s velkými a malými písmeny přesně (Co je kobalt, CO oxid uhelnatý). Hodnotí se první kontrola; po chybě můžete odpověď opravit nebo zobrazit řešení a otázka se jednou vrátí na konec. Výsledek se do pokroku zatím nezapočítává.";
const DESCRIPTIONS: Readonly<Record<ProductionRecallMode, string>> = {
  products: `U každé otázky uvidíte výchozí látky s koeficienty. Za šipku napište do políček vzorce produktů, v libovolném pořadí a bez koeficientů. Po správné odpovědi se koeficienty doplní. ${COMMON_RULES}`,
  equation: `U každé otázky uvidíte jen látku a to, zda se připravuje v laboratoři, nebo vyrábí v průmyslu. Do políček vlevo od šipky napište výchozí látky, vpravo produkty, bez koeficientů. Uznává se kterýkoli ověřený postup; políčka lze přidat i odebrat. ${COMMON_RULES}`,
};

function routesOf(question: ProductionRecallQuestion): readonly Route[] {
  return question.mode === "products" ? [question.route] : question.routes;
}

/**
 * Typed recall of preparation and production, one formula per slot. Only the first check of a
 * question is scored; after a wrong check the learner may correct the answer or reveal the
 * solution, and the question then returns once at the end, as in the choice quiz.
 * Coefficients are never required: a correct answer gets the reviewed coefficients filled in.
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
      <QuizSetup
        available={available}
        description={DESCRIPTIONS[mode]}
        helpId={`production-${mode}`}
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

/** The scored first check, the latest result and whether the question is open or done. */
function useCheck<Result>() {
  const [result, setResult] = useState<Result | null>(null);
  const [firstCorrect, setFirstCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<CardStatus>("open");
  return {
    result,
    firstCorrect,
    status,
    record(graded: Result, correct: boolean) {
      setResult(graded);
      setFirstCorrect((current) => current ?? correct);
      if (correct) setStatus("solved");
    },
    reveal() {
      setFirstCorrect((current) => current ?? false);
      setStatus("revealed");
    },
  };
}

function setAt(values: readonly string[], index: number, value: string): string[] {
  return values.map((current, position) => (position === index ? value : current));
}

function ProductsCard({
  question,
  names,
  symbols,
  onComplete,
  onSkip,
}: CardProps<ProductionProductsQuestion>) {
  const headingId = useId();
  const productCount = new Set(question.route.products.map((term) => term.formula)).size;
  const [slots, setSlots] = useState<readonly string[]>(() => Array(productCount).fill(""));
  const [unreadable, setUnreadable] = useState<readonly number[]>([]);
  const check = useCheck<Extract<ProductSlotsResult, { status: "graded" }>>();
  const hint = reactionByproductHint(question.route, question.product.formula, names);
  const done = check.status !== "open";
  const graded = check.result;

  function submit() {
    if (done) return;
    const result = gradeProductSlots(slots, question.route.products, symbols);
    if (result.status === "unreadable") {
      setUnreadable(result.unreadable);
      return;
    }
    setUnreadable([]);
    check.record(result, result.correct);
  }

  return (
    <section
      aria-labelledby={headingId}
      className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-7"
      data-question-id={question.id}
    >
      <p className="text-center text-sm font-semibold text-ink-3">
        {ROUTE_KIND_LABELS[question.kind]}
      </p>
      <h2 className="mt-2 text-center text-lg font-semibold text-ink" id={headingId}>
        Které produkty vzniknou?
      </h2>
      {done ? null : (
        <QuestionTools
          hint={<ByproductHintText hint={hint} />}
          onSkip={check.firstCorrect === null ? onSkip : undefined}
        />
      )}
      <SlotForm
        canSubmit={slots.some((slot) => slot.trim() !== "")}
        done={done}
        onSubmit={submit}
        unreadable={unreadable.length > 0}
      >
        <span className="flex min-h-12 items-center font-display text-2xl font-bold text-ink sm:text-3xl">
          <span className="sr-only">Výchozí látky: </span>
          <EquationTerms terms={question.route.reactants} />
        </span>
        <Arrow />
        <SlotGroup
          coefficients={
            check.status === "solved"
              ? coefficientsFor(graded?.slots, question.route.products)
              : null
          }
          disabled={done}
          label="Produkt"
          matches={graded && !done ? graded.slots : null}
          onChange={(index, value) => {
            setSlots((current) => setAt(current, index, value));
            setUnreadable([]);
          }}
          unreadable={unreadable}
          values={slots}
        />
      </SlotForm>
      {question.route.conditionsCs ? (
        <p className="mt-2 text-center text-sm text-ink-2">
          Podmínky nad šipkou: {question.route.conditionsCs}
        </p>
      ) : null}
      {check.status === "open" && graded ? (
        <WrongAnswer onReveal={check.reveal}>
          <MissingText count={graded.missingCount} forms={PRODUCT_FORMS} />
        </WrongAnswer>
      ) : null}
      {done ? (
        <Outcome
          firstCorrect={check.firstCorrect === true}
          onContinue={() => onComplete(check.firstCorrect === true)}
          status={check.status}
        >
          <p>
            Celá rovnice:{" "}
            <BalancedEquation
              animate={check.status === "solved" ? "products" : "none"}
              route={question.route}
            />
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
  const distinct = (terms: Route["reactants"]) => new Set(terms.map((term) => term.formula)).size;
  const [reactants, setReactants] = useState<readonly string[]>(() =>
    Array(distinct(question.hintRoute.reactants)).fill(""),
  );
  const [products, setProducts] = useState<readonly string[]>(() =>
    Array(distinct(question.hintRoute.products)).fill(""),
  );
  const [unreadable, setUnreadable] = useState<{
    reactants: readonly number[];
    products: readonly number[];
  }>({ reactants: [], products: [] });
  const check = useCheck<Extract<RouteSlotsResult<Route>, { status: "graded" }>>();
  const done = check.status !== "open";
  const graded = check.result;
  const solvedRoute = check.status === "solved" ? (graded?.route ?? null) : null;
  const others = question.routes.filter((route) => route.id !== solvedRoute?.id);
  const filled = (values: readonly string[]) => values.some((value) => value.trim() !== "");

  function submit() {
    if (done) return;
    const result = gradeRouteSlots(reactants, products, question.routes, symbols);
    if (result.status === "unreadable") {
      setUnreadable({ reactants: result.reactants, products: result.products });
      return;
    }
    setUnreadable({ reactants: [], products: [] });
    check.record(result, result.correct);
  }

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
        className="mt-2 text-center font-display text-2xl leading-10 font-bold text-ink sm:text-3xl"
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
          onSkip={check.firstCorrect === null ? onSkip : undefined}
        />
      )}
      <SlotForm
        below={
          done ? null : (
            <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <SlotCountButtons
                label="výchozí látka"
                onChange={(count) => setReactants((current) => resize(current, count))}
                value={reactants.length}
              />
              <SlotCountButtons
                label="produkt"
                onChange={(count) => setProducts((current) => resize(current, count))}
                value={products.length}
              />
            </div>
          )
        }
        canSubmit={filled(reactants) && filled(products)}
        done={done}
        onSubmit={submit}
        unreadable={unreadable.reactants.length + unreadable.products.length > 0}
      >
        <SlotGroup
          coefficients={
            solvedRoute ? coefficientsFor(graded?.reactants.slots, solvedRoute.reactants) : null
          }
          disabled={done}
          label="Výchozí látka"
          matches={graded && !done ? graded.reactants.slots : null}
          onChange={(index, value) => {
            setReactants((current) => setAt(current, index, value));
            setUnreadable({ reactants: [], products: [] });
          }}
          unreadable={unreadable.reactants}
          values={reactants}
        />
        <Arrow />
        <SlotGroup
          coefficients={
            solvedRoute ? coefficientsFor(graded?.products.slots, solvedRoute.products) : null
          }
          disabled={done}
          label="Produkt"
          matches={graded && !done ? graded.products.slots : null}
          onChange={(index, value) => {
            setProducts((current) => setAt(current, index, value));
            setUnreadable({ reactants: [], products: [] });
          }}
          unreadable={unreadable.products}
          values={products}
        />
      </SlotForm>
      {check.status === "open" && graded ? (
        <WrongAnswer onReveal={check.reveal}>
          <p>
            Tato reakce není mezi ověřenými postupy pro látku{" "}
            <NamedSubstance {...question.product} />. Označení u políček je srovnání s nejbližším z
            nich.
          </p>
          <MissingText
            count={graded.reactants.missingCount}
            forms={["výchozí látka", "výchozí látky", "výchozích látek"]}
          />
          <MissingText count={graded.products.missingCount} forms={PRODUCT_FORMS} />
        </WrongAnswer>
      ) : null}
      {done ? (
        <Outcome
          firstCorrect={check.firstCorrect === true}
          onContinue={() => onComplete(check.firstCorrect === true)}
          status={check.status}
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

function resize(values: readonly string[], count: number): string[] {
  return count > values.length
    ? [...values, ...Array<string>(count - values.length).fill("")]
    : values.slice(0, count);
}

/** The reviewed coefficient for each slot that matched a term; null for others. */
function coefficientsFor(
  slots: readonly (RecallTerm | null)[] | undefined,
  terms: Route["reactants"],
): readonly (number | null)[] | null {
  if (!slots) return null;
  return slots.map((slot) =>
    slot?.expectedIndex === null || slot?.expectedIndex === undefined
      ? null
      : (terms[slot.expectedIndex]?.coefficient ?? null),
  );
}

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="flex min-h-12 items-center px-1 font-display text-3xl font-bold text-ink"
    >
      →
    </span>
  );
}

/** The equation row: Enter in any slot checks the answer. */
function SlotForm({
  children,
  below,
  done,
  canSubmit,
  unreadable,
  onSubmit,
}: Readonly<{
  children: ReactNode;
  /** Shown between the equation row and the check button. */
  below?: ReactNode;
  /** The question is solved or revealed: the slots are read-only and no check is offered. */
  done: boolean;
  canSubmit: boolean;
  unreadable: boolean;
  onSubmit: () => void;
}>) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => rowRef.current?.querySelector("input")?.focus(), []);
  return (
    <form
      className="mt-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit && !done) onSubmit();
      }}
    >
      <div
        className="flex flex-wrap items-start justify-center gap-x-2 gap-y-3"
        data-slot-row=""
        ref={rowRef}
      >
        {children}
      </div>
      {unreadable ? (
        <p className="mt-3 text-center text-sm text-bad" role="alert">
          Označené políčko nelze přečíst. Do každého políčka napište jeden vzorec, například H2SO4.
        </p>
      ) : null}
      {below}
      {done ? null : (
        <div className="mt-4 flex justify-center">
          <button
            className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-on-fill hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-3"
            disabled={!canSubmit}
            type="submit"
          >
            Zkontrolovat
          </button>
        </div>
      )}
    </form>
  );
}

const VERDICT_TEXT = {
  correct: "správně",
  duplicate: "dvakrát",
  wrong: "nepatří sem",
} as const;

/** One side of the equation as formula slots separated by „+“. */
function SlotGroup({
  label,
  values,
  disabled,
  matches,
  coefficients,
  unreadable,
  onChange,
}: Readonly<{
  label: string;
  values: readonly string[];
  disabled: boolean;
  /** The verdict per slot after a wrong check; null hides the verdicts. */
  matches: SlotSideResult["slots"] | null;
  /** Reviewed coefficients shown in front of the slots after a correct check. */
  coefficients: readonly (number | null)[] | null;
  unreadable: readonly number[];
  onChange: (index: number, value: string) => void;
}>) {
  return (
    <>
      {values.map((value, index) => {
        const match = matches?.[index] ?? null;
        const coefficient = coefficients?.[index] ?? null;
        const invalid = unreadable.includes(index);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional; values change as typed.
          <span className="contents" key={index}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="flex min-h-12 items-center text-2xl font-bold text-ink-2"
              >
                +
              </span>
            ) : null}
            <span className="flex items-start gap-1">
              {coefficient !== null && coefficient !== 1 ? (
                <span className="flex min-h-12 items-center font-display text-2xl font-bold">
                  <Coefficient animate value={coefficient} />
                </span>
              ) : null}
              <FormulaSlot
                disabled={disabled}
                invalid={invalid}
                label={`${label} ${index + 1}`}
                match={match}
                onChange={(next) => onChange(index, next)}
                value={value}
              />
            </span>
          </span>
        );
      })}
    </>
  );
}

function FormulaSlot({
  label,
  value,
  disabled,
  invalid,
  match,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  disabled: boolean;
  invalid: boolean;
  match: RecallTerm | null;
  onChange: (value: string) => void;
}>) {
  const verdictId = useId();
  const tone =
    match === null
      ? invalid
        ? "border-bad"
        : "border-line-strong"
      : match.verdict === "correct"
        ? "border-good bg-good-soft"
        : "border-bad bg-bad-soft";

  /** „+“ (or „,“) moves to the next slot, as Tab does, instead of being typed. */
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "+" && event.key !== ",") return;
    event.preventDefault();
    const row = event.currentTarget.closest("[data-slot-row]");
    const inputs = [...(row?.querySelectorAll<HTMLInputElement>("input:not(:disabled)") ?? [])];
    inputs[inputs.indexOf(event.currentTarget) + 1]?.focus();
  }

  return (
    <span className="flex w-28 flex-col items-center gap-1 sm:w-36">
      <input
        aria-describedby={match ? verdictId : undefined}
        aria-invalid={invalid || match?.verdict === "wrong" || match?.verdict === "duplicate"}
        aria-label={label}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={`min-h-12 w-full rounded-xl border-2 bg-surface px-2 text-center font-mono text-lg text-ink disabled:opacity-100 ${tone}`}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        value={value}
      />
      <span aria-hidden="true" className="min-h-6 text-base leading-6 text-ink-2">
        <SlotPreview value={value} />
      </span>
      {match ? (
        <span
          className={`flex items-center gap-1 text-xs font-semibold ${
            match.verdict === "correct" ? "text-good" : "text-bad"
          }`}
          id={verdictId}
        >
          {match.verdict === "correct" ? <CheckIcon /> : <CrossIcon />}
          {VERDICT_TEXT[match.verdict]}
        </span>
      ) : null}
    </span>
  );
}

const SUBSCRIPT_DIGITS = /[₀-₉]/gu;
const TYPED_TERM = /^(\d*)\s*([A-Za-z0-9()[\]]+)$/u;

/** Typeset preview of a slot, so H2SO4 reads as H₂SO₄ while typing. */
function SlotPreview({ value }: Readonly<{ value: string }>) {
  const plain = value
    .trim()
    .replace(SUBSCRIPT_DIGITS, (digit) => String(digit.charCodeAt(0) - "₀".charCodeAt(0)));
  if (plain === "") return null;
  const match = TYPED_TERM.exec(plain);
  return match ? <Formula formula={match[2] ?? ""} /> : plain;
}

function SlotCountButtons({
  label,
  value,
  onChange,
}: Readonly<{ label: string; value: number; onChange: (count: number) => void }>) {
  const button =
    "min-h-11 min-w-11 rounded-xl border border-line-strong bg-surface px-3 font-semibold text-ink hover:bg-surface-3 disabled:cursor-not-allowed disabled:text-ink-3";
  return (
    <span className="flex items-center gap-2">
      <button
        className={button}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        type="button"
      >
        − {label}
      </button>
      <button
        className={button}
        disabled={value >= MAX_SLOTS}
        onClick={() => onChange(value + 1)}
        type="button"
      >
        + {label}
      </button>
    </span>
  );
}

function MissingText({
  count,
  forms,
}: Readonly<{ count: number; forms: readonly [string, string, string] }>) {
  if (count === 0) return null;
  return (
    <p>
      {count === 1 ? "Chybí ještě " : "Chybějí ještě "}
      {czechCount(count, forms)}.
    </p>
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
      <p className="mt-2 text-sm text-ink-2">
        Opravte označená políčka a zkontrolujte znovu, nebo:
      </p>
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
