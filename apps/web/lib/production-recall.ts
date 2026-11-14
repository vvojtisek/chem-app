import type {
  PreparationProductionRuntimeProduct,
  PreparationProductionRuntimeRoute,
} from "@inorganic/content/preparation-production";

import { drawSeries } from "./periodic-table-scope";
import {
  listProductionQuizRoutes,
  listProductionRouteTargets,
  type ProductionQuizKind,
  type ProductionQuizOption,
} from "./preparation-production-quiz";

/**
 * Typed-answer modes of the preparation and production quiz.
 * `products` (Pokročilá): the reactants with coefficients are shown, the learner types the
 * products. `equation` (Pro): only the substance and the route kind are named, the learner
 * types the whole reaction; any reviewed route of that substance and kind is accepted.
 */
export type ProductionRecallMode = "products" | "equation";

export interface ProductionProductsQuestion {
  /** The route ID. */
  readonly id: string;
  readonly mode: "products";
  readonly kind: PreparationProductionRuntimeRoute["kind"];
  /** The substance the route is listed under. */
  readonly product: ProductionQuizOption;
  readonly route: PreparationProductionRuntimeRoute;
}

export interface ProductionEquationQuestion {
  /** The product ID and the route kind: one question per substance and kind. */
  readonly id: string;
  readonly mode: "equation";
  readonly kind: PreparationProductionRuntimeRoute["kind"];
  readonly product: ProductionQuizOption;
  /** Every reviewed route of this kind listed under the substance; each one is accepted. */
  readonly routes: readonly PreparationProductionRuntimeRoute[];
  /** The route the hints reveal, drawn from `routes`. */
  readonly hintRoute: PreparationProductionRuntimeRoute;
}

export type ProductionRecallQuestion = ProductionProductsQuestion | ProductionEquationQuestion;

export interface ProductionRecallSettings {
  readonly kind: ProductionQuizKind;
  /** Number of questions; null asks every eligible one. */
  readonly count: number | null;
}

function toOption(product: PreparationProductionRuntimeProduct): ProductionQuizOption {
  return { id: product.id, nameCs: product.nameCs, formula: product.formula };
}

/** How many questions a mode and kind can offer. */
export function countProductionRecallQuestions(
  products: readonly PreparationProductionRuntimeProduct[],
  kind: ProductionQuizKind,
  mode: ProductionRecallMode,
): number {
  return mode === "products"
    ? listProductionQuizRoutes(products, kind).length
    : listProductionRouteTargets(products, kind).length;
}

/**
 * A shuffled series. Questions use the same eligible routes as the choice quiz: a route is
 * asked only under a substance that it actually yields, and duplicate readings are asked once.
 */
export function createProductionRecall(
  products: readonly PreparationProductionRuntimeProduct[],
  mode: ProductionRecallMode,
  settings: ProductionRecallSettings,
  random: () => number,
): readonly ProductionRecallQuestion[] {
  if (mode === "products") {
    const eligible = listProductionQuizRoutes(products, settings.kind);
    return drawSeries(eligible, settings.count ?? eligible.length, random).map(
      ({ product, route }) => ({
        id: route.id,
        mode,
        kind: route.kind,
        product: toOption(product),
        route,
      }),
    );
  }
  const targets = listProductionRouteTargets(products, settings.kind);
  return drawSeries(targets, settings.count ?? targets.length, random).flatMap((target) => {
    const [hintRoute] = drawSeries(target.routes, 1, random);
    if (!hintRoute) return [];
    return [
      {
        id: `${target.product.id}|${target.kind}`,
        mode,
        kind: target.kind,
        product: toOption(target.product),
        routes: target.routes,
        hintRoute,
      },
    ];
  });
}
