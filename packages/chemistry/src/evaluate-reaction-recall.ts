import { countEquationAtoms } from "./evaluate-equation-answer";
import {
  type EquationTerm,
  hasReducedEquationCoefficients,
  isBalancedEquation,
  type ParsedEquation,
  parseEquationFormula,
  parseEquationTerms,
} from "./parse-equation";

/**
 * Grading for reaction recall without required coefficients: the learner types the products of
 * given reactants, or a whole reaction for a named substance. Formulas are compared as written
 * (case-sensitive canonical notation or a reviewed alias), never by atom counts, so "ClZn2" is
 * not accepted for "ZnCl2" and "co" is not "CO".
 */

/** How one typed formula compares with the expected side of the reaction. */
export type RecallTermVerdict =
  /** Matches an expected formula that no earlier typed term matched. */
  | "correct"
  /** Matches an expected formula already matched by an earlier typed term. */
  | "duplicate"
  /** A readable formula that is not on this side of the reaction. */
  | "wrong";

export interface RecallTerm {
  /** The formula as typed, without its coefficient. */
  readonly formula: string;
  /** The typed coefficient; 1 when none was written. */
  readonly coefficient: number;
  readonly verdict: RecallTermVerdict;
  /** Index of the matched expected term, or null for a wrong or duplicate term. */
  readonly expectedIndex: number | null;
}

export interface RecallSideMatch {
  readonly terms: readonly RecallTerm[];
  /** Expected formulas that no typed term matched. */
  readonly missingCount: number;
  readonly correct: boolean;
}

const SEPARATOR = /[+,]/u;
const TERM_SYNTAX = /^\s*\d*\s*[A-Za-z0-9₀-₉()[\]]+\s*$/u;

/**
 * Splits a typed side of a reaction into terms. Returns null when a term cannot be read at all
 * (an empty term, stray characters, unbalanced brackets), so the caller can ask for a fix
 * instead of grading a typo. Coefficients are kept but never required.
 */
export function readRecallTerms(input: string): readonly EquationTerm[] | null {
  const pieces = input.split(SEPARATOR);
  if (pieces.length > 32) return null;
  const terms: EquationTerm[] = [];
  for (const piece of pieces) {
    if (!TERM_SYNTAX.test(piece)) return null;
    const parsed = parseEquationTerms(piece);
    const [term] = parsed ?? [];
    if (!term || parsed?.length !== 1) return null;
    terms.push(term);
  }
  return terms;
}

function acceptedForms(term: EquationTerm, allowedSymbols: ReadonlySet<string>): Set<string> {
  const forms = new Set<string>();
  for (const formula of [term.formula, ...(term.acceptedAliases ?? [])]) {
    const parsed = parseEquationFormula(formula, allowedSymbols);
    if (parsed) forms.add(parsed.canonical);
  }
  return forms;
}

/**
 * Pairs typed terms with expected ones in typing order; each expected term is used once.
 * Coefficients are ignored here.
 */
export function matchRecallSide(
  entered: readonly EquationTerm[],
  expected: readonly EquationTerm[],
  allowedSymbols: ReadonlySet<string>,
): RecallSideMatch {
  const accepted = expected.map((term) => acceptedForms(term, allowedSymbols));
  const used = new Set<number>();
  const terms = entered.map((term): RecallTerm => {
    const canonical = parseEquationFormula(term.formula, allowedSymbols)?.canonical;
    const indices = canonical
      ? accepted.flatMap((forms, index) => (forms.has(canonical) ? [index] : []))
      : [];
    const free = indices.find((index) => !used.has(index));
    if (free !== undefined) {
      used.add(free);
      return {
        formula: term.formula,
        coefficient: term.coefficient,
        verdict: "correct",
        expectedIndex: free,
      };
    }
    return {
      formula: term.formula,
      coefficient: term.coefficient,
      verdict: indices.length > 0 ? "duplicate" : "wrong",
      expectedIndex: null,
    };
  });
  const missingCount = expected.length - used.size;
  return {
    terms,
    missingCount,
    correct: missingCount === 0 && terms.every((term) => term.verdict === "correct"),
  };
}

export type ProductRecallResult =
  | { readonly status: "unreadable" }
  | ({ readonly status: "graded" } & RecallSideMatch);

/**
 * „Reactants → ?“ with typed products: any order, coefficients optional and ignored, so
 * "H2 + ZnCl2" and "ZnCl2 + 2 H2" both name the products of Zn + 2 HCl.
 */
export function gradeProductRecall(
  input: string,
  expected: readonly EquationTerm[],
  allowedSymbols: ReadonlySet<string>,
): ProductRecallResult {
  const entered = readRecallTerms(input);
  if (!entered) return { status: "unreadable" };
  return { status: "graded", ...matchRecallSide(entered, expected, allowedSymbols) };
}

/** A typed whole reaction; "->", "→" and "=" are accepted as the arrow. */
export function readRecallEquation(input: string): ParsedEquation | null {
  const unified = input.replace(/[→⟶]/gu, "->").replace(/=>?/gu, "->");
  const arrow = unified.indexOf("->");
  if (arrow < 0 || unified.indexOf("->", arrow + 2) >= 0) return null;
  const reactants = readRecallTerms(unified.slice(0, arrow));
  const products = readRecallTerms(unified.slice(arrow + 2));
  return reactants && products ? { reactants, products } : null;
}

/**
 * - `omitted`: no coefficient was written; the reviewed ones are filled in.
 * - `matched`: the written coefficients are the reviewed ones.
 * - `unbalanced`: written coefficients do not conserve atoms.
 * - `unreduced`: they conserve atoms but are not the lowest whole-number ratio.
 * - `different`: they conserve atoms in lowest terms but differ from the reviewed equation.
 */
export type RecallCoefficients = "omitted" | "matched" | "unbalanced" | "unreduced" | "different";

export type EquationRecallResult<Route extends ParsedEquation> =
  | { readonly status: "unreadable" }
  | {
      readonly status: "graded";
      readonly correct: boolean;
      /** The reviewed route whose formulas the answer uses, or null when none fits. */
      readonly route: Route | null;
      readonly coefficients: RecallCoefficients | null;
      readonly reactants: RecallSideMatch;
      readonly products: RecallSideMatch;
    };

function writtenCoefficients(answer: ParsedEquation): boolean {
  return [...answer.reactants, ...answer.products].some((term) => term.coefficient !== 1);
}

function sameCoefficients(entered: RecallSideMatch, expected: readonly EquationTerm[]): boolean {
  return entered.terms.every(
    (term) =>
      term.expectedIndex !== null && expected[term.expectedIndex]?.coefficient === term.coefficient,
  );
}

/**
 * A whole reaction for „how is X made“: correct when its formulas are those of one of the
 * reviewed `routes` (any order on each side) and the coefficients are either all left out or
 * exactly the reviewed ones. Any of several reviewed routes is accepted.
 */
export function gradeEquationRecall<Route extends ParsedEquation>(
  input: string,
  routes: readonly Route[],
  allowedSymbols: ReadonlySet<string>,
): EquationRecallResult<Route> {
  const answer = readRecallEquation(input);
  if (!answer) return { status: "unreadable" };

  const attempts = routes.map((route) => ({
    route,
    reactants: matchRecallSide(answer.reactants, route.reactants, allowedSymbols),
    products: matchRecallSide(answer.products, route.products, allowedSymbols),
  }));
  const fitting = attempts.filter(
    (attempt) => attempt.reactants.correct && attempt.products.correct,
  );
  const closest =
    fitting[0] ?? [...attempts].sort((left, right) => score(right) - score(left))[0] ?? null;
  if (fitting.length === 0) {
    return {
      status: "graded",
      correct: false,
      route: null,
      coefficients: null,
      reactants: closest?.reactants ?? matchRecallSide(answer.reactants, [], allowedSymbols),
      products: closest?.products ?? matchRecallSide(answer.products, [], allowedSymbols),
    };
  }

  if (!writtenCoefficients(answer)) {
    const [first] = fitting;
    if (!first) throw new Error("unreachable");
    return { status: "graded", correct: true, coefficients: "omitted", ...first };
  }

  const exact = fitting.find(
    (attempt) =>
      sameCoefficients(attempt.reactants, attempt.route.reactants) &&
      sameCoefficients(attempt.products, attempt.route.products),
  );
  if (exact) return { status: "graded", correct: true, coefficients: "matched", ...exact };

  const [first] = fitting;
  if (!first) throw new Error("unreachable");
  const balanced =
    countEquationAtoms(answer.reactants, answer.products, allowedSymbols) !== null &&
    isBalancedEquation(answer.reactants, answer.products, allowedSymbols);
  const coefficients: RecallCoefficients = !balanced
    ? "unbalanced"
    : hasReducedEquationCoefficients(answer.reactants, answer.products)
      ? "different"
      : "unreduced";
  return { status: "graded", correct: false, coefficients, ...first };
}

function score(attempt: { reactants: RecallSideMatch; products: RecallSideMatch }): number {
  const right = (side: RecallSideMatch) =>
    side.terms.filter((term) => term.verdict === "correct").length - side.missingCount;
  return right(attempt.reactants) + right(attempt.products);
}
