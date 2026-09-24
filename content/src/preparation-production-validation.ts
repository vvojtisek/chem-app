import {
  hasReducedEquationCoefficients,
  isBalancedEquation,
  parseEquationFormula,
} from "@inorganic/chemistry";
import type { PreparationProductionProduct } from "./preparation-production-schema";

export interface PreparationProductionProblem {
  readonly code:
    | "duplicate_product_id"
    | "duplicate_route_id"
    | "invalid_product_formula"
    | "missing_source"
    | "unreviewed_route_without_note"
    | "invalid_equation_formula"
    | "unbalanced_approved_equation"
    | "unreduced_approved_equation";
  readonly recordId: string;
}

export function findPreparationProductionProblems(
  products: readonly PreparationProductionProduct[],
  allowedSymbols: ReadonlySet<string>,
): readonly PreparationProductionProblem[] {
  const problems: PreparationProductionProblem[] = [];
  const productIds = new Set<string>();
  const routeIds = new Set<string>();

  for (const product of products) {
    if (productIds.has(product.id)) {
      problems.push({ code: "duplicate_product_id", recordId: product.id });
    }
    productIds.add(product.id);
    if (!parseEquationFormula(product.formula, allowedSymbols)) {
      problems.push({ code: "invalid_product_formula", recordId: product.id });
    }
    if (product.status === "owner-approved" && product.sources.length === 0) {
      problems.push({ code: "missing_source", recordId: product.id });
    }

    for (const route of product.routes) {
      if (routeIds.has(route.id)) problems.push({ code: "duplicate_route_id", recordId: route.id });
      routeIds.add(route.id);
      if (route.status === "in-review" && !route.reviewNote) {
        problems.push({ code: "unreviewed_route_without_note", recordId: route.id });
      }
      const terms = [...route.reactants, ...route.products];
      if (terms.some((term) => !parseEquationFormula(term.formula, allowedSymbols))) {
        problems.push({ code: "invalid_equation_formula", recordId: route.id });
        continue;
      }
      if (route.status !== "owner-approved") continue;
      if (!isBalancedEquation(route.reactants, route.products, allowedSymbols)) {
        problems.push({ code: "unbalanced_approved_equation", recordId: route.id });
      }
      if (!hasReducedEquationCoefficients(route.reactants, route.products)) {
        problems.push({ code: "unreduced_approved_equation", recordId: route.id });
      }
    }
  }
  return problems;
}
