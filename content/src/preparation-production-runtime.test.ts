import { gradeApprovedEquations, gradeEquationProducts } from "@inorganic/chemistry";
import { describe, expect, it } from "vitest";
import { curatedPreparationProduction } from "./preparation-production-runtime";
import { curatedElements } from "./runtime";

const symbols = new Set(curatedElements.map((element) => element.symbol));
const routes = curatedPreparationProduction.flatMap((product) => product.routes);

function routeWith(formula: string) {
  const route = routes.find((candidate) =>
    [...candidate.reactants, ...candidate.products].some((term) => term.formula === formula),
  );
  if (!route) throw new Error(`Missing approved route for ${formula}.`);
  return route;
}

function side(
  terms: readonly { readonly coefficient: number; readonly formula: string }[],
): string {
  return terms
    .map(({ coefficient, formula }) => `${coefficient === 1 ? "" : `${coefficient} `}${formula}`)
    .join(" + ");
}

describe("approved equation notation aliases", () => {
  it.each([
    ["Na2SO3S", "Na2S2O3"],
    ["Pb2PbO4", "Pb3O4"],
  ])("accepts product notation %s as %s", (canonical, alias) => {
    const route = routeWith(canonical);
    expect(
      gradeEquationProducts(
        route.products
          .map((term) => (term.formula === canonical ? alias : term.formula))
          .join(" + "),
        route.products,
        symbols,
      ),
    ).toBe(true);
  });

  it("accepts unbracketed nickel carbonyl only for the approved term", () => {
    const route = routeWith("[Ni(CO)4]");
    expect(
      gradeApprovedEquations(
        `${side(route.reactants).replace("[Ni(CO)4]", "Ni(CO)4")} -> ${side(route.products)}`,
        [route],
        symbols,
      ).correct,
    ).toBe(true);
  });
});
