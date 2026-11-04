import { listFormulaElements } from "@inorganic/chemistry";
import type {
  PreparationProductionRuntimeProduct,
  PreparationProductionRuntimeRoute,
} from "@inorganic/content/preparation-production";

import { drawSeries } from "./periodic-table-scope";
import { drawRanked, reactantKey } from "./preparation-production-quiz";

export interface ReactionProductsOption {
  /** The sorted product formulas joined by „+“; identifies the option within a question. */
  readonly id: string;
  /** Product formulas without coefficients, in display order. */
  readonly formulas: readonly string[];
}

export interface ReactionProductsQuestion {
  /** The route ID. */
  readonly id: string;
  readonly route: PreparationProductionRuntimeRoute;
  readonly answerId: string;
  /** The answer and up to three distractors in random order. */
  readonly options: readonly ReactionProductsOption[];
}

const DISTRACTOR_COUNT = 3;
/** A formula used at least this often in reviewed routes counts as a common substance. */
const COMMON_FORMULA_COUNT = 3;

function setKey(formulas: readonly string[]): string {
  return [...new Set(formulas)].sort().join("+");
}

function toOption(formulas: readonly string[]): ReactionProductsOption {
  return { id: setKey(formulas), formulas };
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function isSubset(small: ReadonlySet<string>, large: ReadonlySet<string>): boolean {
  return [...small].every((value) => large.has(value));
}

/** Every route once, so a reaction cited by two sources or two products is asked once. */
export function listReactionProductRoutes(
  products: readonly PreparationProductionRuntimeProduct[],
): readonly {
  readonly product: PreparationProductionRuntimeProduct;
  readonly route: PreparationProductionRuntimeRoute;
}[] {
  const seen = new Set<string>();
  return products.flatMap((product) =>
    product.routes.flatMap((route) => {
      const key = `${reactantKey(route)}>${setKey(route.products.map((term) => term.formula))}|${route.conditionsCs ?? ""}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ product, route }];
    }),
  );
}

/**
 * Wrong product sets for „reactants → ?“. A candidate is offered only when it cannot be the
 * complete set of products: its elements differ from the elements of the reactants, so no
 * equation with these reactants can balance to it. It is also never the product set of any
 * reviewed route with the same reactants, never a part or an extension of the right answer,
 * and never repeats a reactant. Candidates that swap one product of the answer for a formula
 * with a shared element come first, because they look closest to the answer: swaps that bring
 * in at most oxygen or hydrogen, then swaps for common substances, then other swaps adding one
 * element, then product sets of other routes.
 */
export function listProductDistractors(
  route: PreparationProductionRuntimeRoute,
  routes: readonly PreparationProductionRuntimeRoute[],
  allowedSymbols: ReadonlySet<string>,
): readonly { readonly option: ReactionProductsOption; readonly rank: number }[] {
  const elementsCache = new Map<string, readonly string[] | null>();
  const elementsOf = (formula: string) => {
    if (!elementsCache.has(formula)) {
      elementsCache.set(formula, listFormulaElements(formula, allowedSymbols));
    }
    return elementsCache.get(formula) ?? null;
  };
  const elementSet = (formulas: readonly string[]): ReadonlySet<string> | null => {
    const symbols = new Set<string>();
    for (const formula of formulas) {
      const elements = elementsOf(formula);
      if (!elements) return null;
      for (const symbol of elements) symbols.add(symbol);
    }
    return symbols;
  };

  const reactantFormulas = new Set(route.reactants.map((term) => term.formula));
  const reactantElements = elementSet([...reactantFormulas]);
  const answer = [...new Set(route.products.map((term) => term.formula))];
  const answerSet = new Set(answer);
  if (!reactantElements) return [];

  const key = reactantKey(route);
  const forbidden = new Set<string>([setKey(answer)]);
  for (const other of routes) {
    if (reactantKey(other) === key)
      forbidden.add(setKey(other.products.map((term) => term.formula)));
  }

  const seen = new Set<string>();
  const result: { option: ReactionProductsOption; rank: number }[] = [];
  function offer(formulas: readonly string[], rank: number) {
    const unique = [...new Set(formulas)];
    if (unique.length !== formulas.length || unique.length === 0) return;
    const optionKey = setKey(unique);
    if (seen.has(optionKey) || forbidden.has(optionKey)) return;
    if (unique.some((formula) => reactantFormulas.has(formula))) return;
    const candidateSet = new Set(unique);
    if (isSubset(candidateSet, answerSet) || isSubset(answerSet, candidateSet)) return;
    const elements = elementSet(unique);
    if (!elements || reactantElements === null || sameSet(elements, reactantElements)) return;
    seen.add(optionKey);
    result.push({ option: toOption(unique), rank });
  }

  // How often a formula appears in the reviewed routes; common substances look more plausible.
  const frequency = new Map<string, number>();
  for (const other of routes) {
    for (const term of [...other.reactants, ...other.products]) {
      frequency.set(term.formula, (frequency.get(term.formula) ?? 0) + 1);
    }
  }
  const newElements = (formula: string) =>
    (elementsOf(formula) ?? []).filter((symbol) => !reactantElements.has(symbol));

  for (const [index, replaced] of answer.entries()) {
    const replacedElements = new Set(elementsOf(replaced) ?? []);
    for (const formula of [...frequency.keys()].sort()) {
      if (answerSet.has(formula)) continue;
      if (!(elementsOf(formula) ?? []).some((symbol) => replacedElements.has(symbol))) continue;
      const added = newElements(formula);
      if (added.length > 1) continue;
      const rank = added.every((symbol) => symbol === "O" || symbol === "H")
        ? 0
        : (frequency.get(formula) ?? 0) >= COMMON_FORMULA_COUNT
          ? 1
          : 2;
      offer(
        answer.map((current, position) => (position === index ? formula : current)),
        rank,
      );
    }
  }
  for (const other of routes) {
    const formulas = other.products.map((term) => term.formula);
    const added = new Set(formulas.flatMap(newElements));
    const sharesElement = formulas.some((formula) =>
      (elementsOf(formula) ?? []).some((symbol) => reactantElements.has(symbol)),
    );
    offer(formulas, added.size <= 1 && sharesElement ? 3 : 4);
  }
  return result;
}

export function createReactionProductsQuestion(
  route: PreparationProductionRuntimeRoute,
  routes: readonly PreparationProductionRuntimeRoute[],
  allowedSymbols: ReadonlySet<string>,
  random: () => number,
): ReactionProductsQuestion {
  const answer = toOption([...new Set(route.products.map((term) => term.formula))]);
  const distractors = drawRanked(
    listProductDistractors(route, routes, allowedSymbols),
    (candidate) => candidate.rank,
    DISTRACTOR_COUNT,
    random,
  ).map((candidate) => candidate.option);
  const options = [answer, ...distractors];
  return {
    id: route.id,
    route,
    answerId: answer.id,
    options: drawSeries(options, options.length, random),
  };
}

/** Graded by the set of product formulas, never by the position of the option. */
export function isReactionProductsAnswerCorrect(
  question: ReactionProductsQuestion,
  optionId: string,
): boolean {
  return question.answerId === optionId;
}
