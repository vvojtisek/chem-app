import {
  deriveBalancing,
  type EquationTerm,
  hasReducedEquationCoefficients,
  isBalancedEquation,
  parseEquationFormula,
} from "@inorganic/chemistry";

import type { BalancingReactionLesson, ReactionSpecies } from "./balancing-reactions-schema";

export interface BalancingReactionProblem {
  readonly code:
    | "duplicate_lesson_id"
    | "invalid_formula"
    | "unbalanced_lesson"
    | "unreduced_lesson"
    | "unbalanced_charge"
    | "invalid_step_formula"
    | "invalid_step_ledger"
    | "missing_final_summary"
    | "placeholder_derivation"
    | "invalid_derivation_constraint";
  readonly recordId: string;
}

function asEquationTerms(species: readonly ReactionSpecies[]): EquationTerm[] {
  return species.map(({ coefficient, formula }) => ({ coefficient, formula }));
}

function chargeTotal(species: readonly ReactionSpecies[]): number {
  return species.reduce((total, term) => total + term.coefficient * term.charge, 0);
}

function atomLedger(
  reactants: readonly ReactionSpecies[],
  products: readonly ReactionSpecies[],
  allowedSymbols: ReadonlySet<string>,
): {
  readonly reactants: Readonly<Record<string, number>>;
  readonly products: Readonly<Record<string, number>>;
} | null {
  const count = (species: readonly ReactionSpecies[]) => {
    const result: Record<string, number> = {};
    for (const term of species) {
      const parsed = parseEquationFormula(term.formula, allowedSymbols);
      if (!parsed) return null;
      for (const [element, amount] of Object.entries(parsed.atomCounts)) {
        result[element] = (result[element] ?? 0) + amount * term.coefficient;
      }
    }
    return result;
  };
  const left = count(reactants);
  const right = count(products);
  return left && right ? { reactants: left, products: right } : null;
}

export function findBalancingReactionProblems(
  lessons: readonly BalancingReactionLesson[],
  allowedSymbols: ReadonlySet<string>,
): readonly BalancingReactionProblem[] {
  const problems: BalancingReactionProblem[] = [];
  const ids = new Set<string>();

  for (const lesson of lessons) {
    if (ids.has(lesson.id)) problems.push({ code: "duplicate_lesson_id", recordId: lesson.id });
    ids.add(lesson.id);

    for (const step of lesson.steps) {
      if (/Tím přiblížíme bilanci|nejmenšímu celočíselnému poměru/u.test(step.explanation))
        problems.push({ code: "placeholder_derivation", recordId: lesson.id });
      const stepTerms = [...step.equation.reactants, ...step.equation.products];
      if (stepTerms.some((term) => !parseEquationFormula(term.formula, allowedSymbols))) {
        problems.push({ code: "invalid_step_formula", recordId: lesson.id });
        continue;
      }
      const expectedLedger = atomLedger(
        step.equation.reactants,
        step.equation.products,
        allowedSymbols,
      );
      const suppliedAtoms = step.balanceLedger?.atoms;
      if (suppliedAtoms && expectedLedger) {
        const elements = new Set([
          ...Object.keys(expectedLedger.reactants),
          ...Object.keys(expectedLedger.products),
        ]);
        const supplied = new Map(suppliedAtoms.map((entry) => [entry.element, entry]));
        if (
          supplied.size !== elements.size ||
          [...elements].some(
            (element) =>
              supplied.get(element)?.reactants !== (expectedLedger.reactants[element] ?? 0) ||
              supplied.get(element)?.products !== (expectedLedger.products[element] ?? 0),
          )
        ) {
          problems.push({ code: "invalid_step_ledger", recordId: lesson.id });
        }
      }
      if (step.balanceLedger?.charge) {
        if (
          step.balanceLedger.charge.reactants !== chargeTotal(step.equation.reactants) ||
          step.balanceLedger.charge.products !== chargeTotal(step.equation.products)
        ) {
          problems.push({ code: "invalid_step_ledger", recordId: lesson.id });
        }
      }
    }

    const finalStep = lesson.steps.at(-1);
    if (!finalStep) continue;
    if (lesson.derivationConstraints?.length) {
      const derived = deriveBalancing(
        finalStep.equation.reactants,
        finalStep.equation.products,
        allowedSymbols,
        lesson.derivationConstraints,
      );
      const saved = [...finalStep.equation.reactants, ...finalStep.equation.products];
      if (
        !derived.ok ||
        derived.coefficients.some((value, index) => value !== saved[index]?.coefficient)
      )
        problems.push({ code: "invalid_derivation_constraint", recordId: lesson.id });
    }
    const ionic = [...finalStep.equation.reactants, ...finalStep.equation.products].some(
      (term) => term.charge !== 0,
    );
    if (
      finalStep.kind !== "summary" ||
      !finalStep.balanceLedger?.atoms?.length ||
      (ionic && !finalStep.balanceLedger.charge)
    ) {
      problems.push({ code: "missing_final_summary", recordId: lesson.id });
    }
    const reactants = asEquationTerms(finalStep.equation.reactants);
    const products = asEquationTerms(finalStep.equation.products);
    if (
      reactants.some((term) => !parseEquationFormula(term.formula, allowedSymbols)) ||
      products.some((term) => !parseEquationFormula(term.formula, allowedSymbols))
    ) {
      problems.push({ code: "invalid_formula", recordId: lesson.id });
      continue;
    }
    if (!isBalancedEquation(reactants, products, allowedSymbols)) {
      problems.push({ code: "unbalanced_lesson", recordId: lesson.id });
    }
    if (!hasReducedEquationCoefficients(reactants, products)) {
      problems.push({ code: "unreduced_lesson", recordId: lesson.id });
    }
    if (chargeTotal(finalStep.equation.reactants) !== chargeTotal(finalStep.equation.products)) {
      problems.push({ code: "unbalanced_charge", recordId: lesson.id });
    }
  }

  return problems;
}
