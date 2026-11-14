import {
  type EquationTerm,
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

/**
 * One typed formula slot. A leading coefficient is allowed and ignored („2 HCl“ reads as HCl).
 * `empty` for a blank slot, null when the slot holds anything but one readable term.
 */
export function readRecallSlot(input: string): EquationTerm | "empty" | null {
  if (input.trim() === "") return "empty";
  if (/[+,]/u.test(input)) return null;
  const [term] = readRecallTerms(input) ?? [];
  return term ?? null;
}

export interface SlotSideResult extends RecallSideMatch {
  /** The match of each typed slot, aligned with the input; null for a blank slot. */
  readonly slots: readonly (RecallTerm | null)[];
}

function matchSlots(
  terms: readonly (EquationTerm | "empty")[],
  expected: readonly EquationTerm[],
  allowedSymbols: ReadonlySet<string>,
): SlotSideResult {
  const filled = terms.filter((term): term is EquationTerm => term !== "empty");
  const match = matchRecallSide(filled, expected, allowedSymbols);
  let next = 0;
  const slots = terms.map((term) => (term === "empty" ? null : (match.terms[next++] ?? null)));
  return { ...match, slots };
}

function readSlots(
  inputs: readonly string[],
):
  | { readonly ok: true; readonly terms: readonly (EquationTerm | "empty")[] }
  | { readonly ok: false; readonly unreadable: readonly number[] } {
  const read = inputs.map(readRecallSlot);
  const unreadable = read.flatMap((term, index) => (term === null ? [index] : []));
  if (unreadable.length > 0) return { ok: false, unreadable };
  return { ok: true, terms: read as readonly (EquationTerm | "empty")[] };
}

export type ProductSlotsResult =
  | { readonly status: "unreadable"; readonly unreadable: readonly number[] }
  | ({ readonly status: "graded" } & SlotSideResult);

/**
 * „Reactants → ?“ with one typed formula per slot: any order, blank slots ignored, coefficients
 * ignored. Correct when the filled slots name exactly the products of the reaction.
 */
export function gradeProductSlots(
  inputs: readonly string[],
  expected: readonly EquationTerm[],
  allowedSymbols: ReadonlySet<string>,
): ProductSlotsResult {
  const read = readSlots(inputs);
  if (!read.ok) return { status: "unreadable", unreadable: read.unreadable };
  return { status: "graded", ...matchSlots(read.terms, expected, allowedSymbols) };
}

export type RouteSlotsResult<Route extends ParsedEquation> =
  | {
      readonly status: "unreadable";
      readonly reactants: readonly number[];
      readonly products: readonly number[];
    }
  | {
      readonly status: "graded";
      readonly correct: boolean;
      /** The reviewed route whose formulas the answer names, or the closest one when none fits. */
      readonly route: Route | null;
      readonly reactants: SlotSideResult;
      readonly products: SlotSideResult;
    };

/**
 * A whole reaction typed into reactant and product slots, for „how is X made“. Correct when
 * the filled slots name the formulas of one of the reviewed `routes` (any order on each side).
 * Coefficients are never required and typed ones are ignored; the reviewed ones are shown after.
 * When no route fits, the comparison is with the route that most of the answer matches.
 */
export function gradeRouteSlots<Route extends ParsedEquation>(
  reactantInputs: readonly string[],
  productInputs: readonly string[],
  routes: readonly Route[],
  allowedSymbols: ReadonlySet<string>,
): RouteSlotsResult<Route> {
  const reactants = readSlots(reactantInputs);
  const products = readSlots(productInputs);
  if (!reactants.ok || !products.ok) {
    return {
      status: "unreadable",
      reactants: reactants.ok ? [] : reactants.unreadable,
      products: products.ok ? [] : products.unreadable,
    };
  }
  const attempts = routes.map((route) => ({
    route,
    reactants: matchSlots(reactants.terms, route.reactants, allowedSymbols),
    products: matchSlots(products.terms, route.products, allowedSymbols),
  }));
  const fitting = attempts.find((attempt) => attempt.reactants.correct && attempt.products.correct);
  if (fitting) return { status: "graded", correct: true, ...fitting };
  const closest = [...attempts].sort((left, right) => score(right) - score(left))[0];
  return {
    status: "graded",
    correct: false,
    route: null,
    reactants: closest?.reactants ?? matchSlots(reactants.terms, [], allowedSymbols),
    products: closest?.products ?? matchSlots(products.terms, [], allowedSymbols),
  };
}

function score(attempt: { reactants: RecallSideMatch; products: RecallSideMatch }): number {
  const right = (side: RecallSideMatch) =>
    side.terms.filter((term) => term.verdict === "correct").length - side.missingCount;
  return right(attempt.reactants) + right(attempt.products);
}
