import type {
  PreparationProductionRuntimeProduct,
  PreparationProductionRuntimeRoute,
} from "@inorganic/content/preparation-production";

import { drawSeries } from "./periodic-table-scope";

export type ProductionQuizKind = "all" | PreparationProductionRuntimeRoute["kind"];

export interface ProductionQuizOption {
  readonly id: string;
  readonly nameCs: string;
  readonly formula: string;
}

export interface ProductionQuizQuestion {
  /** The route ID, stable across content versions. */
  readonly id: string;
  readonly kind: PreparationProductionRuntimeRoute["kind"];
  readonly route: PreparationProductionRuntimeRoute;
  readonly answer: ProductionQuizOption;
  /** The answer and up to three distractors in random order. */
  readonly options: readonly ProductionQuizOption[];
}

export interface ProductionQuizSettings {
  readonly kind: ProductionQuizKind;
  /** Number of questions; null asks every eligible route. */
  readonly count: number | null;
}

const DISTRACTOR_COUNT = 3;

interface EligibleRoute {
  readonly product: PreparationProductionRuntimeProduct;
  readonly route: PreparationProductionRuntimeRoute;
}

function toOption(product: PreparationProductionRuntimeProduct): ProductionQuizOption {
  return { id: product.id, nameCs: product.nameCs, formula: product.formula };
}

function reactantKey(route: PreparationProductionRuntimeRoute): string {
  return [...new Set(route.reactants.map((term) => term.formula))].sort().join("+");
}

function equationKey(route: PreparationProductionRuntimeRoute): string {
  const side = (terms: PreparationProductionRuntimeRoute["reactants"]) =>
    terms.map((term) => `${term.coefficient} ${term.formula}`).join(" + ");
  return `${route.kind}|${side(route.reactants)}|${side(route.products)}|${route.conditionsCs ?? ""}`;
}

/**
 * Routes that can be asked: the route belongs to a product and that product's formula is one
 * of the route's products, so „which substance is made this way“ has the owning product as
 * its answer. A product's routes that read the same (cited by two sources) are asked once.
 */
export function listProductionQuizRoutes(
  products: readonly PreparationProductionRuntimeProduct[],
  kind: ProductionQuizKind = "all",
): readonly EligibleRoute[] {
  return products.flatMap((product) => {
    const seen = new Set<string>();
    return product.routes
      .filter((route) => {
        if (kind !== "all" && route.kind !== kind) return false;
        if (!route.products.some((term) => term.formula === product.formula)) return false;
        const key = equationKey(route);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((route) => ({ product, route }));
  });
}

/**
 * Formulas that must not be offered as wrong options for a route: every substance on either
 * side of the route, and every product of any reviewed route with the same set of reactants
 * (for example NO and NO2 from Cu and HNO3), because such an option would also be correct.
 */
export function excludedDistractorFormulas(
  route: PreparationProductionRuntimeRoute,
  products: readonly PreparationProductionRuntimeProduct[],
): ReadonlySet<string> {
  const excluded = new Set<string>();
  for (const term of [...route.reactants, ...route.products]) excluded.add(term.formula);

  const key = reactantKey(route);
  for (const product of products) {
    for (const other of product.routes) {
      if (reactantKey(other) !== key) continue;
      excluded.add(product.formula);
      for (const term of other.products) excluded.add(term.formula);
    }
  }
  return excluded;
}

export function createProductionQuizQuestion(
  eligible: EligibleRoute,
  products: readonly PreparationProductionRuntimeProduct[],
  random: () => number,
): ProductionQuizQuestion {
  const { product, route } = eligible;
  const excluded = excludedDistractorFormulas(route, products);
  const candidates = products.filter(
    (candidate) =>
      candidate.id !== product.id &&
      candidate.nameCs !== product.nameCs &&
      !excluded.has(candidate.formula),
  );
  const distractors = drawSeries(candidates, DISTRACTOR_COUNT, random).map(toOption);
  const answer = toOption(product);
  return {
    id: route.id,
    kind: route.kind,
    route,
    answer,
    options: drawSeries([answer, ...distractors], distractors.length + 1, random),
  };
}

/** A shuffled quiz drawn from the eligible routes of the chosen kind. */
export function createProductionQuiz(
  products: readonly PreparationProductionRuntimeProduct[],
  settings: ProductionQuizSettings,
  random: () => number,
): readonly ProductionQuizQuestion[] {
  const eligible = listProductionQuizRoutes(products, settings.kind);
  const drawn = drawSeries(eligible, settings.count ?? eligible.length, random);
  return drawn.map((item) => createProductionQuizQuestion(item, products, random));
}

/** The answer is graded by the stable product ID, never by display text. */
export function isProductionQuizAnswerCorrect(
  question: ProductionQuizQuestion,
  optionId: string,
): boolean {
  return question.answer.id === optionId;
}
