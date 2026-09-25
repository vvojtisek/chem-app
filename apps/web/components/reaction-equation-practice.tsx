"use client";

import {
  countEquationAtoms,
  type EquationAtomBalance,
  gradeApprovedEquations,
  gradeEquationCoefficients,
  gradeEquationProducts,
  parseEquationCoefficient,
} from "@inorganic/chemistry";
import {
  type PreparationProductionRuntimeProduct,
  preparationProductionContentVersion,
} from "@inorganic/content/preparation-production";
import { useMemo, useRef, useState } from "react";
import { useAccount, useCapabilities } from "@/components/auth-gate";
import { Equation, EquationSide, Formula } from "@/components/formula";
import { CheckIcon, CrossIcon } from "@/components/icons";
import { createBrowserProgressStore } from "@/lib/browser-progress-store";
import { createClientId } from "@/lib/client-id";

type Level = "beginner" | "advanced" | "pro";
type Route = PreparationProductionRuntimeProduct["routes"][number];
interface Question {
  readonly product: PreparationProductionRuntimeProduct;
  readonly route: Route;
}

const levelLabels: Readonly<Record<Level, string>> = {
  beginner: "Začátečník",
  advanced: "Pokročilý",
  pro: "Profík",
};

export function ReactionEquationPractice({
  products,
  allowedSymbols,
}: Readonly<{
  products: readonly PreparationProductionRuntimeProduct[];
  allowedSymbols: readonly string[];
}>) {
  const account = useAccount();
  const { canSave } = useCapabilities();
  const symbols = useMemo(() => new Set(allowedSymbols), [allowedSymbols]);
  const sessionId = useRef<string | null>(null);
  const sequence = useRef(0);
  const submissionLocked = useRef(false);
  const questionsByLevel = useMemo(
    () => ({
      beginner: products.flatMap((product) => product.routes.map((route) => ({ product, route }))),
      advanced: products.flatMap((product) => product.routes.map((route) => ({ product, route }))),
      pro: products.flatMap((product) => {
        const productionRoutes = product.routes.filter(
          (route) =>
            route.kind === "manufacture" &&
            route.products.some((term) => term.formula === product.formula),
        );
        const route = productionRoutes[0];
        return route ? [{ product, route }] : [];
      }),
    }),
    [products],
  );

  const [level, setLevel] = useState<Level>("beginner");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [productAnswer, setProductAnswer] = useState("");
  const [coefficients, setCoefficients] = useState<Readonly<Record<string, string>>>({});
  const [equationAnswer, setEquationAnswer] = useState("");
  const [phase, setPhase] = useState<"products" | "coefficients">("products");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | "">("");
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [atomBalance, setAtomBalance] = useState<EquationAtomBalance | null>(null);
  const [balanceFromAnswer, setBalanceFromAnswer] = useState(false);
  const [unreduced, setUnreduced] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");

  const questions = questionsByLevel[level];
  const question = questions[questionIndex];
  const proQuestions =
    level === "pro" && question
      ? (products
          .find((product) => product.id === question.product.id)
          ?.routes.filter(
            (route) =>
              route.kind === "manufacture" &&
              route.products.some((term) => term.formula === question.product.formula),
          ) ?? [])
      : [];

  function changeLevel(nextLevel: Level) {
    setLevel(nextLevel);
    setQuestionIndex(0);
    setProductAnswer("");
    setCoefficients({});
    setEquationAnswer("");
    setPhase("products");
    setFeedback("");
    setCorrectCount(0);
    setIncorrectCount(0);
    setRetrying(false);
    setAtomBalance(null);
    setUnreduced(false);
    setSaveNotice("");
    sessionId.current = null;
    sequence.current = 0;
    submissionLocked.current = false;
  }

  function recordAttempt(isCorrect: boolean) {
    if (!canSave || !account || !question) return;
    sessionId.current ??= createClientId();
    const direction = {
      beginner: "coefficients",
      advanced: "products-and-coefficients",
      pro: "complete-equation",
    } as const;
    const attempt = {
      id: createClientId(),
      questionId: level === "pro" ? question.product.id : question.route.id,
      contentVersion: preparationProductionContentVersion,
      occurredAt: new Date().toISOString(),
      isCorrect,
      round: retrying ? ("retry" as const) : ("initial" as const),
      mode: "equation" as const,
      eventSchemaVersion: 1 as const,
      sessionId: sessionId.current,
      sequence: sequence.current++,
      level,
      direction: direction[level],
      matchPolicy: "approved-balanced" as const,
      progressGeneration: account.progressGeneration,
    };
    void createBrowserProgressStore(indexedDB, account.id)
      .appendAttempt(attempt)
      .catch(() => setSaveNotice("Pokus se nepodařilo uložit. Zkuste odpověď znovu."));
  }

  function finishAnswer(
    correct: boolean,
    enteredBalance: EquationAtomBalance | null,
    balancedButUnreduced = false,
  ) {
    if (!question || submissionLocked.current) return;
    submissionLocked.current = true;
    recordAttempt(correct);
    if (correct) {
      setCorrectCount((count) => count + 1);
      setFeedback("correct");
      setAtomBalance(null);
    } else {
      setIncorrectCount((count) => count + 1);
      setFeedback("incorrect");
      setUnreduced(balancedButUnreduced);
      setBalanceFromAnswer(enteredBalance !== null);
      setAtomBalance(
        enteredBalance ??
          countEquationAtoms(question.route.reactants, question.route.products, symbols),
      );
    }
  }

  function checkProducts() {
    if (!question) return;
    if (!gradeEquationProducts(productAnswer, question.route.products, symbols)) {
      finishAnswer(false, null);
      return;
    }
    setFeedback("");
    setPhase("coefficients");
  }

  function checkCoefficients() {
    if (!question) return;
    const result = gradeEquationCoefficients(coefficients, question.route, symbols);
    finishAnswer(result.correct, result.atomBalance, result.balanced && !result.correct);
  }

  function checkProAnswer() {
    if (!question) return;
    const result = gradeApprovedEquations(equationAnswer, proQuestions, symbols);
    finishAnswer(result.correct, result.atomBalance);
  }

  function advance() {
    if (feedback === "correct") {
      setQuestionIndex((index) => index + 1);
      setRetrying(false);
    } else {
      setRetrying(true);
    }
    setProductAnswer("");
    setCoefficients({});
    setEquationAnswer("");
    setPhase("products");
    setFeedback("");
    setAtomBalance(null);
    setUnreduced(false);
    setSaveNotice("");
    submissionLocked.current = false;
  }

  function changeCoefficient(key: string, value: string) {
    setCoefficients((current) => ({ ...current, [key]: value }));
  }

  if (questions.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-line bg-surface p-5">
        Pro tuto úroveň nejsou připravena zadání.
      </p>
    );
  }

  const editingCoefficients =
    level === "beginner" || (level === "advanced" && phase === "coefficients");

  return (
    <section className="w-full">
      <nav
        aria-label="Obtížnost chemických rovnic"
        className="grid grid-cols-3 gap-1 rounded-xl border border-line-strong bg-surface-3 p-1"
      >
        {(["beginner", "advanced", "pro"] as const).map((option) => (
          <button
            aria-pressed={level === option}
            className={`min-h-11 rounded-lg px-3 font-semibold ${
              level === option ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
            key={option}
            onClick={() => changeLevel(option)}
            type="button"
          >
            {levelLabels[option]}
          </button>
        ))}
      </nav>
      <p className="mt-3 text-sm leading-6 text-ink-2">
        {level === "beginner"
          ? "Vzorce reaktantů i produktů jsou uvedené. Doplňte koeficienty na obou stranách tlačítky − a + nebo číslem; prázdné pole znamená 1."
          : level === "advanced"
            ? "Doplňte nejprve produkty na pravé straně. Potom vyčíslete reaktanty i produkty."
            : "Podle názvu a vzorce produktu napište jednu správnou rovnici výroby. Pokud znáte více ověřených možností, oddělte je středníkem."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex min-h-8 items-center rounded-full bg-surface-2 px-3 font-semibold text-ink tabular-nums">
          Otázka {Math.min(questionIndex + 1, questions.length)} z {questions.length}
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-good-soft px-3 font-semibold text-good">
          <CheckIcon />
          <span>Správně: {correctCount}</span>
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-bad-soft px-3 font-semibold text-bad">
          <CrossIcon />
          <span>Chybně: {incorrectCount}</span>
        </span>
      </div>

      {!question ? (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-2xl font-bold">Tato série je hotová</h2>
          <p className="mt-2">
            Správně: {correctCount} · Chybně: {incorrectCount}
          </p>
          <button
            className="mt-4 min-h-11 rounded-xl border border-line-strong px-4 font-semibold"
            onClick={() => changeLevel(level)}
            type="button"
          >
            Začít znovu
          </button>
        </section>
      ) : (
        <section
          aria-labelledby="equation-heading"
          className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-7"
        >
          <p className="text-sm font-semibold text-ink-3">
            {question.route.kind === "preparation" ? "Příprava" : "Výroba"}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink" id="equation-heading">
            {level === "pro" ? "Vyrobte" : "Reakce produktu"}: {question.product.nameCs} (
            <Formula formula={question.product.formula} />)
          </h2>
          {level === "pro" ? (
            <form
              className="mt-5 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!feedback) checkProAnswer();
              }}
            >
              <label className="grid gap-2 font-medium">
                Chemická rovnice
                <input
                  autoComplete="off"
                  className="min-h-12 w-full rounded-xl border border-line-strong bg-surface px-3 font-mono text-ink"
                  onChange={(event) => setEquationAnswer(event.target.value)}
                  placeholder="např. C + H2O -> H2 + CO"
                  value={equationAnswer}
                />
              </label>
              <p className="text-sm text-ink-2">
                U této látky existuje {proQuestions.length} ověřených rovnic výroby.
              </p>
              {!feedback ? <SubmitButton>Vyhodnotit rovnici</SubmitButton> : null}
            </form>
          ) : (
            <>
              {level === "advanced" ? (
                phase === "products" ? (
                  <>
                    <p className="mt-5 rounded-xl bg-surface-2 p-4 text-lg leading-8">
                      <EquationSide terms={question.route.reactants} withCoefficients={false} /> → ?
                    </p>
                    <form
                      className="mt-4 grid gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!feedback) checkProducts();
                      }}
                    >
                      <label className="grid gap-2 font-medium">
                        Produkty na pravé straně (vzorce oddělte znakem +)
                        <input
                          autoComplete="off"
                          className="min-h-12 rounded-xl border border-line-strong bg-surface px-3 font-mono text-ink"
                          onChange={(event) => setProductAnswer(event.target.value)}
                          placeholder="např. H2 + ZnCl2"
                          value={productAnswer}
                        />
                      </label>
                      {!feedback ? <SubmitButton>Ověřit produkty</SubmitButton> : null}
                    </form>
                  </>
                ) : (
                  <p className="mt-4 font-medium">Nyní doplňte koeficienty na obou stranách.</p>
                )
              ) : null}
              {editingCoefficients ? (
                <>
                  <div className="mt-5">
                    <EquationWithCoefficients
                      disabled={Boolean(feedback)}
                      onChange={changeCoefficient}
                      question={question}
                      values={coefficients}
                    />
                  </div>
                  {feedback ? null : (
                    <LiveAtomBalance question={question} symbols={symbols} values={coefficients} />
                  )}
                  <form
                    className="mt-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!feedback) checkCoefficients();
                    }}
                  >
                    {!feedback ? <SubmitButton>Vyhodnotit koeficienty</SubmitButton> : null}
                  </form>
                </>
              ) : null}
            </>
          )}
          {feedback ? (
            <div
              aria-live="polite"
              className={`mt-5 rounded-2xl border p-4 sm:p-5 ${
                feedback === "correct" ? "border-good/40 bg-good-soft" : "border-bad/40 bg-bad-soft"
              }`}
              role="status"
            >
              <p
                className={`flex items-center gap-2 font-bold ${
                  feedback === "correct" ? "text-good" : "text-bad"
                }`}
              >
                {feedback === "correct" ? <CheckIcon /> : <CrossIcon />}
                <span>{feedback === "correct" ? "Správně." : "To není správné řešení."}</span>
              </p>
              {feedback === "incorrect" ? (
                <div className="mt-2 grid gap-2 text-ink">
                  {unreduced ? (
                    <p className="text-sm">
                      Počty atomů souhlasí, ale koeficienty nejsou v nejmenším celočíselném poměru.
                    </p>
                  ) : null}
                  <p>
                    Správně:{" "}
                    <Equation
                      products={question.route.products}
                      reactants={question.route.reactants}
                    />
                  </p>
                  {atomBalance ? (
                    <div className="text-sm">
                      <p className="font-semibold">
                        Počty atomů {balanceFromAnswer ? "ve vaší odpovědi" : "ve správné rovnici"}
                      </p>
                      <p>Vlevo: {formatAtomCounts(atomBalance.reactants)}</p>
                      <p>Vpravo: {formatAtomCounts(atomBalance.products)}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {level === "pro" && feedback === "incorrect" ? (
                <ul className="mt-2 grid gap-1 text-ink">
                  {proQuestions.map((route) => (
                    <li key={route.id}>
                      <Equation products={route.products} reactants={route.reactants} />
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                className="mt-4 min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill"
                onClick={advance}
                type="button"
              >
                {feedback === "correct" ? "Další úloha" : "Zkusit znovu"}
              </button>
            </div>
          ) : null}
          {saveNotice ? (
            <p className="mt-3 text-sm text-bad" role="alert">
              {saveNotice}
            </p>
          ) : null}
        </section>
      )}
    </section>
  );
}

const MAX_COEFFICIENT = 999;

function EquationWithCoefficients({
  question,
  values,
  onChange,
  disabled,
}: Readonly<{
  question: Question;
  values: Readonly<Record<string, string>>;
  onChange: (key: string, value: string) => void;
  disabled: boolean;
}>) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl bg-surface-2 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
      <CoefficientSide
        disabled={disabled}
        label="reaktant"
        onChange={onChange}
        side="reactant"
        terms={question.route.reactants}
        values={values}
      />
      <span aria-label="vzniká" className="px-1 text-2xl text-ink-2" role="img">
        →
      </span>
      <CoefficientSide
        disabled={disabled}
        label="produkt"
        onChange={onChange}
        side="product"
        terms={question.route.products}
        values={values}
      />
    </div>
  );
}

function CoefficientSide({
  side,
  label,
  terms,
  values,
  onChange,
  disabled,
}: Readonly<{
  side: "reactant" | "product";
  label: string;
  terms: readonly { readonly coefficient: number; readonly formula: string }[];
  values: Readonly<Record<string, string>>;
  onChange: (key: string, value: string) => void;
  disabled: boolean;
}>) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {terms.map((term, index) => {
        const key = `${side}-${index}`;
        const value = values[key] ?? "";
        // Unreadable input steps from 1, like a blank field.
        const current = parseEquationCoefficient(value) ?? 1;
        const name = `koeficient ${label} ${term.formula}`;
        return (
          <span className="flex items-center gap-2" key={key}>
            {index > 0 ? (
              <span aria-hidden="true" className="text-lg text-ink-2">
                +
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-xl border border-line-strong bg-surface">
              <button
                aria-label={`Snížit ${name}`}
                className="grid h-11 w-9 place-items-center rounded-l-xl text-lg font-bold text-ink-2 hover:bg-surface-3 disabled:opacity-40"
                disabled={disabled || current <= 1}
                onClick={() => onChange(key, String(current - 1))}
                type="button"
              >
                −
              </button>
              <input
                aria-label={`Koeficient ${label} ${term.formula}`}
                autoComplete="off"
                className="h-11 w-11 border-x border-line bg-surface text-center font-mono text-lg font-semibold text-ink tabular-nums"
                inputMode="numeric"
                maxLength={3}
                onChange={(event) => onChange(key, event.target.value)}
                placeholder="1"
                value={value}
              />
              <button
                aria-label={`Zvýšit ${name}`}
                className="grid h-11 w-9 place-items-center rounded-r-xl text-lg font-bold text-ink-2 hover:bg-surface-3 disabled:opacity-40"
                disabled={disabled || current >= MAX_COEFFICIENT}
                onClick={() => onChange(key, String(current + 1))}
                type="button"
              >
                +
              </button>
            </span>
            <Formula className="text-xl text-ink" formula={term.formula} />
          </span>
        );
      })}
    </span>
  );
}

/** Atom counts of the entry so far, recomputed on every change of a coefficient. */
function LiveAtomBalance({
  question,
  values,
  symbols,
}: Readonly<{
  question: Question;
  values: Readonly<Record<string, string>>;
  symbols: ReadonlySet<string>;
}>) {
  const { atomBalance } = gradeEquationCoefficients(values, question.route, symbols);
  if (!atomBalance) {
    return (
      <p className="mt-3 text-sm text-warn" role="status">
        Koeficienty zapisujte jako celá čísla od 1 do {MAX_COEFFICIENT}.
      </p>
    );
  }
  const elements = [
    ...new Set([...Object.keys(atomBalance.reactants), ...Object.keys(atomBalance.products)]),
  ];
  return (
    <table className="mt-4 w-full max-w-md border-collapse text-sm">
      <caption className="mb-2 text-left font-semibold text-ink">Počty atomů</caption>
      <thead>
        <tr className="border-b border-line text-left text-ink-2">
          <th className="py-1.5 pr-3 font-semibold" scope="col">
            Prvek
          </th>
          <th className="py-1.5 pr-3 text-right font-semibold" scope="col">
            Vlevo
          </th>
          <th className="py-1.5 pr-3 text-right font-semibold" scope="col">
            Vpravo
          </th>
          <th className="py-1.5 font-semibold" scope="col">
            Stav
          </th>
        </tr>
      </thead>
      <tbody>
        {elements.map((symbol) => {
          const left = atomBalance.reactants[symbol] ?? 0;
          const right = atomBalance.products[symbol] ?? 0;
          const even = left === right;
          return (
            <tr className="border-b border-line" key={symbol}>
              <th className="py-1.5 pr-3 text-left font-semibold text-ink" scope="row">
                {symbol}
              </th>
              <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{left}</td>
              <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{right}</td>
              <td className={`py-1.5 font-semibold ${even ? "text-good" : "text-bad"}`}>
                <span aria-hidden="true">{even ? "✓ " : "≠ "}</span>
                {even ? "souhlasí" : "nesouhlasí"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SubmitButton({ children }: Readonly<{ children: string }>) {
  return (
    <button className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-on-fill" type="submit">
      {children}
    </button>
  );
}

function formatAtomCounts(counts: Readonly<Record<string, number>>) {
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([symbol, count]) => `${symbol}: ${count}`)
    .join(" · ");
}
