import rawData from "../data/preparation-production.json";
import {
  hasReducedEquationCoefficients,
  isBalancedEquation,
  parseEquationFormula,
} from "@inorganic/chemistry";
import { curatedElements } from "./runtime";
import { preparationProductionCollectionSchema } from "./preparation-production-schema";

const collection = preparationProductionCollectionSchema.parse(rawData);
const allowedSymbols = new Set(curatedElements.map((element) => element.symbol));

export interface PreparationProductionRuntimeRoute {
  readonly id: string;
  readonly sourceId: string;
  readonly kind: "preparation" | "manufacture";
  readonly reactants: readonly { readonly coefficient: number; readonly formula: string }[];
  readonly products: readonly { readonly coefficient: number; readonly formula: string }[];
  readonly conditionsCs: string | null;
}

export interface PreparationProductionRuntimeProduct {
  readonly id: string;
  readonly nameCs: string;
  readonly formula: string;
  readonly notes: readonly {
    readonly kind: "preparation" | "manufacture";
    readonly text: string;
  }[];
  readonly routes: readonly PreparationProductionRuntimeRoute[];
  readonly reviewLevel: "owner-approved";
  readonly sources: readonly { readonly title: string; readonly locator: string }[];
}

/** Runtime content includes owner-approved material and only validated, approved equations. */
export const curatedPreparationProduction: readonly PreparationProductionRuntimeProduct[] =
  collection.products
    .filter((product) => parseEquationFormula(product.formula, allowedSymbols) !== null)
    .map((product) => ({
    id: product.id,
    nameCs: product.nameCs,
    formula: product.formula,
    notes: product.notes,
    routes: product.routes
      .filter(
        (route) =>
          route.status === "owner-approved" &&
          isBalancedEquation(route.reactants, route.products, allowedSymbols) &&
          hasReducedEquationCoefficients(route.reactants, route.products),
      )
      .map(({ id, sourceId, kind, reactants, products, conditionsCs }) => ({
        id,
        sourceId,
        kind,
        reactants,
        products,
        conditionsCs,
      })),
    reviewLevel: "owner-approved",
    sources: product.sources,
    }));
