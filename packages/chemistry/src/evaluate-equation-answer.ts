import {
  type EquationTerm,
  hasReducedEquationCoefficients,
  isBalancedEquation,
  type ParsedEquation,
  parseEquationAnswer,
  parseEquationFormula,
  parseEquationTerms,
} from "./parse-equation";

export interface EquationAtomBalance {
  readonly reactants: Readonly<Record<string, number>>;
  readonly products: Readonly<Record<string, number>>;
}

export function countEquationAtoms(
  reactants: readonly EquationTerm[],
  products: readonly EquationTerm[],
  allowedSymbols: ReadonlySet<string>,
): EquationAtomBalance | null {
  function countSide(terms: readonly EquationTerm[]): Record<string, number> | null {
    if (terms.length === 0) return null;
    const totals: Record<string, number> = {};
    for (const term of terms) {
      if (!Number.isSafeInteger(term.coefficient) || term.coefficient < 1 || term.coefficient > 999)
        return null;
      const parsed = parseEquationFormula(term.formula, allowedSymbols);
      if (!parsed) return null;
      for (const [symbol, quantity] of Object.entries(parsed.atomCounts)) {
        const total = (totals[symbol] ?? 0) + quantity * term.coefficient;
        if (!Number.isSafeInteger(total)) return null;
        totals[symbol] = total;
      }
    }
    return totals;
  }

  const left = countSide(reactants);
  const right = countSide(products);
  return left && right ? { reactants: left, products: right } : null;
}

function sameFormulas(
  entered: readonly EquationTerm[],
  expected: readonly EquationTerm[],
  allowedSymbols: ReadonlySet<string>,
): boolean {
  if (entered.length !== expected.length) return false;
  const formulas = entered.map(
    (term) => parseEquationFormula(term.formula, allowedSymbols)?.canonical,
  );
  if (formulas.some((formula) => formula === undefined)) return false;
  const accepted = expected.map((term) =>
    [term.formula, ...(term.acceptedAliases ?? [])].map(
      (formula) => parseEquationFormula(formula, allowedSymbols)?.canonical,
    ),
  );
  if (accepted.some((options) => options.some((formula) => formula === undefined))) return false;
  const used = new Set<number>();
  function match(index: number): boolean {
    if (index === formulas.length) return true;
    for (const [candidateIndex, options] of accepted.entries()) {
      if (used.has(candidateIndex) || !options.includes(formulas[index])) continue;
      used.add(candidateIndex);
      if (match(index + 1)) return true;
      used.delete(candidateIndex);
    }
    return false;
  }
  return match(0);
}

/** The product-entry step accepts known formulas in either order, without coefficients. */
export function gradeEquationProducts(
  input: string,
  expected: readonly EquationTerm[],
  allowedSymbols: ReadonlySet<string>,
): boolean {
  const parsed = parseEquationTerms(input);
  if (!parsed) return false;
  return (
    parsed.every((term) => term.coefficient === 1) && sameFormulas(parsed, expected, allowedSymbols)
  );
}

function parseCoefficient(value: string): number | null {
  if (value === "") return 1;
  if (!/^[1-9][0-9]{0,2}$/u.test(value)) return null;
  return Number(value);
}

/** Grade a complete coefficient entry by conservation and its lowest integer ratio. */
export function gradeEquationCoefficients(
  values: Readonly<Record<string, string>>,
  approved: ParsedEquation,
  allowedSymbols: ReadonlySet<string>,
): { readonly correct: boolean; readonly atomBalance: EquationAtomBalance | null } {
  const withCoefficients = (
    terms: readonly EquationTerm[],
    side: "reactant" | "product",
  ): EquationTerm[] | null => {
    const parsed: EquationTerm[] = [];
    for (const [index, term] of terms.entries()) {
      const coefficient = parseCoefficient(values[`${side}-${index}`] ?? "");
      if (coefficient === null) return null;
      parsed.push({ formula: term.formula, coefficient });
    }
    return parsed;
  };
  const reactants = withCoefficients(approved.reactants, "reactant");
  const products = withCoefficients(approved.products, "product");
  if (reactants === null || products === null) {
    return { correct: false, atomBalance: null };
  }
  const atomBalance = countEquationAtoms(reactants, products, allowedSymbols);
  return {
    correct:
      atomBalance !== null &&
      isBalancedEquation(reactants, products, allowedSymbols) &&
      hasReducedEquationCoefficients(reactants, products),
    atomBalance,
  };
}

/** Each submitted complete equation must use an approved route's formula terms. */
export function gradeApprovedEquations(
  input: string,
  approved: readonly ParsedEquation[],
  allowedSymbols: ReadonlySet<string>,
): { readonly correct: boolean; readonly atomBalance: EquationAtomBalance | null } {
  const answers = input.split(";").map((answer) => parseEquationAnswer(answer.trim()));
  const first = answers[0];
  const atomBalance = first
    ? countEquationAtoms(first.reactants, first.products, allowedSymbols)
    : null;
  return {
    correct:
      answers.length > 0 &&
      answers.every(
        (answer) =>
          answer !== null &&
          approved.some(
            (route) =>
              sameFormulas(answer.reactants, route.reactants, allowedSymbols) &&
              sameFormulas(answer.products, route.products, allowedSymbols),
          ) &&
          countEquationAtoms(answer.reactants, answer.products, allowedSymbols) !== null &&
          isBalancedEquation(answer.reactants, answer.products, allowedSymbols) &&
          hasReducedEquationCoefficients(answer.reactants, answer.products),
      ),
    atomBalance,
  };
}
