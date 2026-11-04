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

/**
 * `identify-product`: reactants and conditions are shown, the learner picks the substance.
 * `choose-route`: the substance is shown, the learner picks the reactants that make it.
 */
export type ProductionQuizDirection = "identify-product" | "choose-route";

export interface ProductionQuizQuestion {
  /** The route ID, stable across content versions. */
  readonly id: string;
  readonly direction: "identify-product";
  readonly kind: PreparationProductionRuntimeRoute["kind"];
  readonly route: PreparationProductionRuntimeRoute;
  readonly answer: ProductionQuizOption;
  /** The answer and up to three distractors in random order. */
  readonly options: readonly ProductionQuizOption[];
}

export interface ProductionRouteOption {
  /** The route ID. */
  readonly id: string;
  readonly route: PreparationProductionRuntimeRoute;
}

export interface ProductionRouteQuestion {
  /** The product ID and the route kind: one question per product and kind. */
  readonly id: string;
  readonly direction: "choose-route";
  readonly kind: PreparationProductionRuntimeRoute["kind"];
  readonly product: ProductionQuizOption;
  /** The correct route, drawn from the product's eligible routes of this kind. */
  readonly route: PreparationProductionRuntimeRoute;
  /** The correct route and up to three distractor routes in random order. */
  readonly options: readonly ProductionRouteOption[];
}

export type ProductionQuizItem = ProductionQuizQuestion | ProductionRouteQuestion;

export interface ProductionQuizSettings {
  readonly kind: ProductionQuizKind;
  /** Number of questions; null asks every eligible route. */
  readonly count: number | null;
  /** Defaults to `identify-product`. */
  readonly direction?: ProductionQuizDirection;
}

const DISTRACTOR_COUNT = 3;

interface EligibleRoute {
  readonly product: PreparationProductionRuntimeProduct;
  readonly route: PreparationProductionRuntimeRoute;
}

function toOption(product: PreparationProductionRuntimeProduct): ProductionQuizOption {
  return { id: product.id, nameCs: product.nameCs, formula: product.formula };
}

export function reactantKey(route: PreparationProductionRuntimeRoute): string {
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
    direction: "identify-product",
    answer,
    options: drawSeries([answer, ...distractors], distractors.length + 1, random),
  };
}

const ELEMENT_SYMBOL = /[A-Z][a-z]?/gu;

function formulaElements(formula: string): ReadonlySet<string> {
  return new Set(formula.match(ELEMENT_SYMBOL) ?? []);
}

/** 0 is the most alike: same route kind and a reactant sharing an element with the target. */
function routeDistractorRank(
  route: PreparationProductionRuntimeRoute,
  kind: PreparationProductionRuntimeRoute["kind"],
  targetElements: ReadonlySet<string>,
): number {
  const sharesElement = route.reactants.some((term) =>
    [...formulaElements(term.formula)].some((symbol) => targetElements.has(symbol)),
  );
  return (route.kind === kind ? 0 : 2) + (sharesElement ? 0 : 1);
}

export interface EligibleProductKind {
  readonly product: PreparationProductionRuntimeProduct;
  readonly kind: PreparationProductionRuntimeRoute["kind"];
  /** The product's eligible routes of this kind; one of them is the answer. */
  readonly routes: readonly PreparationProductionRuntimeRoute[];
}

/**
 * Wrong routes for „how is this substance made“. A route qualifies only when its reactants
 * lack at least one element of the substance, so by conservation of atoms it cannot make the
 * substance under any conditions (KClO3 is never offered as a wrong way to oxygen, even though
 * its reviewed route makes KClO4). It must also not share its reactants with a reviewed route
 * that yields the substance or belongs to it, which covers intermediate steps of a multi-step
 * manufacture. Routes of the asked kind and routes sharing an element with the substance are
 * preferred, so the options look alike.
 */
export function listRouteDistractors(
  target: PreparationProductionRuntimeProduct,
  kind: PreparationProductionRuntimeRoute["kind"],
  products: readonly PreparationProductionRuntimeProduct[],
): readonly PreparationProductionRuntimeRoute[] {
  const yieldingKeys = new Set<string>();
  for (const product of products) {
    for (const route of product.routes) {
      if (route.products.some((term) => term.formula === target.formula)) {
        yieldingKeys.add(reactantKey(route));
      }
    }
  }
  // Reactants of the substance's own routes, including intermediate steps such as S + O2
  // in the manufacture of H2SO4, are part of the right answer and never a wrong option.
  for (const product of products) {
    if (product.id !== target.id && product.formula !== target.formula) continue;
    for (const route of product.routes) yieldingKeys.add(reactantKey(route));
  }
  const targetElements = formulaElements(target.formula);
  const seen = new Set<string>();
  const ranked: { route: PreparationProductionRuntimeRoute; rank: number }[] = [];
  for (const product of products) {
    for (const route of product.routes) {
      if (yieldingKeys.has(reactantKey(route))) continue;
      const reactantElements = new Set(
        route.reactants.flatMap((term) => [...formulaElements(term.formula)]),
      );
      if ([...targetElements].every((symbol) => reactantElements.has(symbol))) continue;
      // Options differing only in coefficients or conditions would read as the same choice.
      const key = reactantKey(route);
      if (seen.has(key)) continue;
      seen.add(key);
      ranked.push({ route, rank: routeDistractorRank(route, kind, targetElements) });
    }
  }
  return ranked.sort((left, right) => left.rank - right.rank).map(({ route }) => route);
}

/** Products and route kinds that can be asked as „how is this substance made“. */
export function listProductionRouteTargets(
  products: readonly PreparationProductionRuntimeProduct[],
  kind: ProductionQuizKind = "all",
): readonly EligibleProductKind[] {
  const groups = new Map<string, EligibleProductKind>();
  for (const { product, route } of listProductionQuizRoutes(products, kind)) {
    const id = `${product.id}|${route.kind}`;
    const group = groups.get(id);
    groups.set(id, {
      product,
      kind: route.kind,
      routes: group ? [...group.routes, route] : [route],
    });
  }
  return [...groups.values()];
}

/** Draws among the best-ranked distractors first, so a weaker one is used only when needed. */
export function drawRanked<Item>(
  ranked: readonly Item[],
  rankOf: (item: Item) => number,
  limit: number,
  random: () => number,
): readonly Item[] {
  const chosen: Item[] = [];
  const ranks = [...new Set(ranked.map(rankOf))].sort((left, right) => left - right);
  for (const rank of ranks) {
    if (chosen.length >= limit) break;
    const tier = ranked.filter((item) => rankOf(item) === rank);
    chosen.push(...drawSeries(tier, limit - chosen.length, random));
  }
  return chosen;
}

export function createProductionRouteQuestion(
  target: EligibleProductKind,
  products: readonly PreparationProductionRuntimeProduct[],
  random: () => number,
): ProductionRouteQuestion | null {
  const [route] = drawSeries(target.routes, 1, random);
  if (!route) return null;
  const candidates = listRouteDistractors(target.product, target.kind, products);
  const targetElements = formulaElements(target.product.formula);
  const distractors = drawRanked(
    candidates,
    (candidate) => routeDistractorRank(candidate, target.kind, targetElements),
    DISTRACTOR_COUNT,
    random,
  );
  if (distractors.length === 0) return null;
  const options = [route, ...distractors].map((item) => ({ id: item.id, route: item }));
  return {
    id: `${target.product.id}|${target.kind}`,
    direction: "choose-route",
    kind: target.kind,
    product: toOption(target.product),
    route,
    options: drawSeries(options, options.length, random),
  };
}

/** How many questions a direction and kind can offer. */
export function countProductionQuizQuestions(
  products: readonly PreparationProductionRuntimeProduct[],
  kind: ProductionQuizKind,
  direction: ProductionQuizDirection,
): number {
  if (direction === "identify-product") return listProductionQuizRoutes(products, kind).length;
  return listProductionRouteTargets(products, kind).filter(
    (target) => listRouteDistractors(target.product, target.kind, products).length > 0,
  ).length;
}

/** A shuffled quiz drawn from the eligible routes of the chosen kind. */
export function createProductionQuiz(
  products: readonly PreparationProductionRuntimeProduct[],
  settings: ProductionQuizSettings,
  random: () => number,
): readonly ProductionQuizItem[] {
  if (settings.direction === "choose-route") {
    const targets = listProductionRouteTargets(products, settings.kind).filter(
      (target) => listRouteDistractors(target.product, target.kind, products).length > 0,
    );
    const drawn = drawSeries(targets, settings.count ?? targets.length, random);
    return drawn.flatMap((target) => {
      const question = createProductionRouteQuestion(target, products, random);
      return question ? [question] : [];
    });
  }
  const eligible = listProductionQuizRoutes(products, settings.kind);
  const drawn = drawSeries(eligible, settings.count ?? eligible.length, random);
  return drawn.map((item) => createProductionQuizQuestion(item, products, random));
}

/** The answer is graded by the stable product or route ID, never by display text. */
export function isProductionQuizAnswerCorrect(
  question: ProductionQuizItem,
  optionId: string,
): boolean {
  return question.direction === "choose-route"
    ? question.route.id === optionId
    : question.answer.id === optionId;
}
