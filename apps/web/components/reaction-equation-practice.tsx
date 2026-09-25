"use client";

import {
  countEquationAtoms,
  type EquationAtomBalance,
  gradeApprovedEquations,
  gradeEquationCoefficients,
  gradeEquationProducts,
} from "@inorganic/chemistry";
import {
  type PreparationProductionRuntimeProduct,
  preparationProductionContentVersion,
} from "@inorganic/content/preparation-production";
import { useMemo, useRef, useState } from "react";
import { useAccount, useCapabilities } from "@/components/auth-gate";
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

  function finishAnswer(correct: boolean, enteredBalance: EquationAtomBalance | null) {
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
    finishAnswer(result.correct, result.atomBalance);
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
    setSaveNotice("");
    submissionLocked.current = false;
  }

  if (questions.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border bg-white p-5">
        Pro tuto úroveň nejsou připravena zadání.
      </p>
    );
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <nav aria-label="Obtížnost chemických rovnic" className="grid grid-cols-3 gap-2">
        {(["beginner", "advanced", "pro"] as const).map((option) => (
          <button
            aria-pressed={level === option}
            className={`min-h-12 rounded-xl px-3 font-semibold ${level === option ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-900"}`}
            key={option}
            onClick={() => changeLevel(option)}
            type="button"
          >
            {levelLabels[option]}
          </button>
        ))}
      </nav>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {level === "beginner"
          ? "Vzorce reaktantů i produktů jsou uvedené. Doplňte koeficienty na obou stranách; prázdné pole znamená 1."
          : level === "advanced"
            ? "Doplňte nejprve produkty na pravé straně. Potom vyčíslete reaktanty i produkty."
            : "Podle názvu a vzorce produktu napište jednu správnou rovnici výroby. Pokud znáte více ověřených možností, oddělte je středníkem."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
          Otázka {Math.min(questionIndex + 1, questions.length)} z {questions.length}
        </span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-900">
          Správně: {correctCount}
        </span>
        <span className="rounded-full bg-rose-100 px-3 py-1 font-medium text-rose-900">
          Chybně: {incorrectCount}
        </span>
      </div>

      {!question ? (
        <section className="mt-4 rounded-2xl border bg-white p-5">
          <h2 className="text-2xl font-semibold">Tato série je hotová</h2>
          <p className="mt-2">
            Správně: {correctCount} · Chybně: {incorrectCount}
          </p>
          <button
            className="mt-4 min-h-11 rounded-xl border border-slate-300 px-4 font-semibold"
            onClick={() => changeLevel(level)}
            type="button"
          >
            Začít znovu
          </button>
        </section>
      ) : (
        <section
          aria-labelledby="equation-heading"
          className="mt-4 rounded-2xl border bg-white p-5 sm:p-7"
        >
          <p className="text-sm font-semibold text-emerald-800">
            {question.route.kind === "preparation" ? "Příprava" : "Výroba"}
          </p>
          <h2 className="mt-1 text-xl font-semibold" id="equation-heading">
            {level === "pro" ? "Vyrobte" : "Reakce produktu"}: {question.product.nameCs} (
            {question.product.formula})
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
                  className="min-h-12 w-full rounded-xl border border-slate-300 px-3 font-mono"
                  onChange={(event) => setEquationAnswer(event.target.value)}
                  placeholder="např. C + H2O -> H2 + CO"
                  value={equationAnswer}
                />
              </label>
              <p className="text-sm text-slate-600">
                U této látky existuje {proQuestions.length} ověřených rovnic výroby.
              </p>
              {!feedback ? <SubmitButton>Vyhodnotit rovnici</SubmitButton> : null}
            </form>
          ) : (
            <>
              {level === "beginner" ? (
                <div className="mt-5">
                  <EquationWithCoefficients
                    question={question}
                    values={coefficients}
                    onChange={(key, value) =>
                      setCoefficients((current) => ({ ...current, [key]: value }))
                    }
                  />
                </div>
              ) : (
                <>
                  <p className="mt-5 rounded-xl bg-slate-50 p-4 font-mono leading-7">
                    {formatFormulaSide(question.route.reactants)} → ?
                  </p>
                  {phase === "products" ? (
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
                          className="min-h-12 rounded-xl border border-slate-300 px-3 font-mono"
                          onChange={(event) => setProductAnswer(event.target.value)}
                          placeholder="např. H2 + ZnCl2"
                          value={productAnswer}
                        />
                      </label>
                      {!feedback ? <SubmitButton>Ověřit produkty</SubmitButton> : null}
                    </form>
                  ) : (
                    <div className="mt-4">
                      <p className="font-mono text-slate-700">
                        {formatFormulaSide(question.route.reactants)} →{" "}
                        {formatFormulaSide(question.route.products)}
                      </p>
                      <p className="mt-2 font-medium">Nyní doplňte koeficienty na obou stranách.</p>
                      <EquationWithCoefficients
                        question={question}
                        values={coefficients}
                        onChange={(key, value) =>
                          setCoefficients((current) => ({ ...current, [key]: value }))
                        }
                      />
                    </div>
                  )}
                </>
              )}
              {level === "beginner" || phase === "coefficients" ? (
                <form
                  className="mt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!feedback) checkCoefficients();
                  }}
                >
                  {!feedback ? <SubmitButton>Vyhodnotit koeficienty</SubmitButton> : null}
                </form>
              ) : null}
            </>
          )}
          {feedback ? (
            <div aria-live="polite" className="mt-4 rounded-xl bg-slate-50 p-4" role="status">
              <p
                className={
                  feedback === "correct"
                    ? "font-semibold text-emerald-900"
                    : "font-semibold text-rose-900"
                }
              >
                {feedback === "correct" ? "Správně." : "To není správné řešení."}
              </p>
              {feedback === "incorrect" ? (
                <>
                  <p className="mt-2 font-mono text-sm">
                    Správně: {formatSide(question.route.reactants)} →{" "}
                    {formatSide(question.route.products)}
                  </p>
                  {atomBalance ? (
                    <div className="mt-3 text-sm">
                      <p className="font-semibold">
                        Počty atomů {balanceFromAnswer ? "ve vaší odpovědi" : "ve správné rovnici"}
                      </p>
                      <p>Vlevo: {formatAtomCounts(atomBalance.reactants)}</p>
                      <p>Vpravo: {formatAtomCounts(atomBalance.products)}</p>
                    </div>
                  ) : null}
                </>
              ) : null}
              {level === "pro" && feedback === "incorrect" ? (
                <ul className="mt-2 grid gap-1 font-mono text-sm">
                  {proQuestions.map((route) => (
                    <li key={route.id}>
                      {formatSide(route.reactants)} → {formatSide(route.products)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                className="mt-3 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
                onClick={advance}
                type="button"
              >
                {feedback === "correct" ? "Další úloha" : "Zkusit znovu"}
              </button>
            </div>
          ) : null}
          {saveNotice ? (
            <p className="mt-3 text-sm text-rose-800" role="alert">
              {saveNotice}
            </p>
          ) : null}
        </section>
      )}
    </section>
  );
}

function EquationWithCoefficients({
  question,
  values,
  onChange,
}: Readonly<{
  question: Question;
  values: Readonly<Record<string, string>>;
  onChange: (key: string, value: string) => void;
}>) {
  return (
    <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <CoefficientSide
        side="reactant"
        label="Reaktant"
        terms={question.route.reactants}
        values={values}
        onChange={onChange}
      />
      <span aria-label="vzniká" className="text-center text-xl" role="img">
        →
      </span>
      <CoefficientSide
        side="product"
        label="Produkt"
        terms={question.route.products}
        values={values}
        onChange={onChange}
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
}: Readonly<{
  side: "reactant" | "product";
  label: string;
  terms: readonly { readonly coefficient: number; readonly formula: string }[];
  values: Readonly<Record<string, string>>;
  onChange: (key: string, value: string) => void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {terms.map((term, index) => (
        <div className="flex items-center gap-2" key={`${side}-${term.formula}`}>
          {index > 0 ? <span aria-hidden="true">+</span> : null}
          <label className="flex min-h-11 items-center gap-1">
            <span className="sr-only">
              Koeficient {label.toLowerCase()} {term.formula}
            </span>
            <input
              autoComplete="off"
              className="h-10 w-14 rounded-lg border border-slate-300 bg-white px-2 text-center font-mono"
              inputMode="numeric"
              maxLength={3}
              onChange={(event) => onChange(`${side}-${index}`, event.target.value)}
              placeholder="1"
              value={values[`${side}-${index}`] ?? ""}
            />
            <span className="font-mono">{term.formula}</span>
          </label>
        </div>
      ))}
    </div>
  );
}

function SubmitButton({ children }: Readonly<{ children: string }>) {
  return (
    <button
      className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
      type="submit"
    >
      {children}
    </button>
  );
}

function formatSide(terms: readonly { readonly coefficient: number; readonly formula: string }[]) {
  return terms
    .map(({ coefficient, formula }) => `${coefficient === 1 ? "" : `${coefficient} `}${formula}`)
    .join(" + ");
}

function formatFormulaSide(terms: readonly { readonly formula: string }[]) {
  return terms.map(({ formula }) => formula).join(" + ");
}

function formatAtomCounts(counts: Readonly<Record<string, number>>) {
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([symbol, count]) => `${symbol}: ${count}`)
    .join(" · ");
}
