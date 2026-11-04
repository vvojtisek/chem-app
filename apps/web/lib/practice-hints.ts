import type {
  PreparationProductionRuntimeProduct,
  PreparationProductionRuntimeRoute,
} from "@inorganic/content/preparation-production";

import type { ProductionRouteQuestion } from "./preparation-production-quiz";

/**
 * Hints derived only from reviewed curriculum data: names, formulas and the reviewed routes
 * themselves. No hint text is written here by hand, so a hint cannot state chemistry that the
 * reviewed data does not contain.
 */

export interface NamedFormula {
  readonly formula: string;
  /** The Czech name of a curriculum product with this formula, if there is one. */
  readonly nameCs: string | null;
}

/** Czech names of curriculum products by formula; the first product with a formula wins. */
export function formulaNames(
  products: readonly PreparationProductionRuntimeProduct[],
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const product of products) {
    if (!names.has(product.formula)) names.set(product.formula, product.nameCs);
  }
  return names;
}

function named(formula: string, names: ReadonlyMap<string, string>): NamedFormula {
  return { formula, nameCs: names.get(formula) ?? null };
}

export interface ProductsHint {
  readonly productCount: number;
  /** One product of the reaction, preferably the substance the route is listed under. */
  readonly product: NamedFormula | null;
}

/** For „reactants → ?“: how many products form and the name of one of them. */
export function reactionProductsHint(
  route: PreparationProductionRuntimeRoute,
  ownerFormula: string,
  names: ReadonlyMap<string, string>,
): ProductsHint {
  const formulas = [...new Set(route.products.map((term) => term.formula))];
  const preferred = formulas.includes(ownerFormula)
    ? ownerFormula
    : formulas.find((formula) => names.has(formula));
  return {
    productCount: formulas.length,
    product: preferred ? named(preferred, names) : null,
  };
}

export type RouteHint =
  | { readonly kind: "reactant"; readonly reactant: NamedFormula }
  | { readonly kind: "count"; readonly reactantCount: number };

/**
 * For „? → substance“: one starting substance of the right route, but only one that also
 * appears in a wrong option, so the hint narrows the choice without giving it away. When every
 * starting substance is unique to the right option, only their number is given.
 */
export function routeReactantHint(
  question: ProductionRouteQuestion,
  names: ReadonlyMap<string, string>,
): RouteHint {
  const reactants = [...new Set(question.route.reactants.map((term) => term.formula))];
  const elsewhere = new Set(
    question.options
      .filter((option) => option.id !== question.route.id)
      .flatMap((option) => option.route.reactants.map((term) => term.formula)),
  );
  const shared = reactants.find((candidate) => elsewhere.has(candidate));
  return shared
    ? { kind: "reactant", reactant: named(shared, names) }
    : { kind: "count", reactantCount: reactants.length };
}

/** For „reactants → which substance“: the elements of the substance, in formula order. */
export function substanceElementsHint(formula: string): readonly string[] {
  return [...new Set(formula.match(/[A-Z][a-z]?/gu) ?? [])];
}
