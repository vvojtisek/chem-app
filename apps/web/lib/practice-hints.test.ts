import type { PreparationProductionRuntimeRoute } from "@inorganic/content/preparation-production";
import { describe, expect, it } from "vitest";

import { reactionProductsHint, routeReactantHint, substanceElementsHint } from "./practice-hints";
import type { ProductionRouteQuestion } from "./preparation-production-quiz";
import { skipPracticeQueue, createPracticeQueue } from "./practice-queue";

function route(
  id: string,
  reactants: readonly string[],
  products: readonly string[],
): PreparationProductionRuntimeRoute {
  return {
    id,
    sourceId: id,
    kind: "preparation",
    reactants: reactants.map((formula) => ({ coefficient: 1, formula })),
    products: products.map((formula) => ({ coefficient: 1, formula })),
    conditionsCs: null,
  };
}

const names = new Map([
  ["H2", "Vodík"],
  ["ZnCl2", "Chlorid zinečnatý"],
]);

describe("reactionProductsHint", () => {
  it("prefers the substance the route is listed under", () => {
    expect(reactionProductsHint(route("r", ["Zn", "HCl"], ["ZnCl2", "H2"]), "H2", names)).toEqual({
      productCount: 2,
      product: { formula: "H2", nameCs: "Vodík" },
    });
  });

  it("falls back to a named product, or none", () => {
    expect(
      reactionProductsHint(route("r", ["S", "O2"], ["SO2", "ZnCl2"]), "H2SO4", names).product,
    ).toEqual({ formula: "ZnCl2", nameCs: "Chlorid zinečnatý" });
    expect(
      reactionProductsHint(route("r", ["S", "O2"], ["SO2"]), "H2SO4", names).product,
    ).toBeNull();
  });
});

describe("routeReactantHint", () => {
  it("names a reactant that also appears in a wrong option", () => {
    const right = route("right", ["Zn", "HCl"], ["ZnCl2", "H2"]);
    const wrong = route("wrong", ["KCN", "HCl"], ["HCN", "KCl"]);
    const question: ProductionRouteQuestion = {
      id: "p.h2|preparation",
      direction: "choose-route",
      kind: "preparation",
      product: { id: "p.h2", nameCs: "Vodík", formula: "H2" },
      route: right,
      options: [
        { id: "right", route: right },
        { id: "wrong", route: wrong },
      ],
    };
    expect(routeReactantHint(question, names)).toEqual({
      kind: "reactant",
      reactant: { formula: "HCl", nameCs: null },
    });
  });

  it("gives only the number of reactants when each is unique to the right option", () => {
    const right = route("right", ["KBr", "Cl2"], ["Br2", "KCl"]);
    const wrong = route("wrong", ["NaCl", "H2SO4"], ["HCl", "NaHSO4"]);
    const question: ProductionRouteQuestion = {
      id: "p.br2|preparation",
      direction: "choose-route",
      kind: "preparation",
      product: { id: "p.br2", nameCs: "Brom", formula: "Br2" },
      route: right,
      options: [
        { id: "right", route: right },
        { id: "wrong", route: wrong },
      ],
    };
    expect(routeReactantHint(question, names)).toEqual({ kind: "count", reactantCount: 2 });
  });
});

describe("substanceElementsHint", () => {
  it("lists distinct elements in formula order", () => {
    expect(substanceElementsHint("Na2[Zn(OH)4]")).toEqual(["Na", "Zn", "O", "H"]);
  });
});

describe("skipPracticeQueue", () => {
  it("moves the current question to the end without grading it", () => {
    const keep = () => 0.999;
    const state = createPracticeQueue([{ id: "a" }, { id: "b" }, { id: "c" }], keep);
    const skipped = skipPracticeQueue(state);
    expect(skipped.current?.id).not.toBe(state.current?.id);
    expect(skipped.queue.at(-1)?.id).toBe(state.current?.id);
    expect(skipped.correct + skipped.incorrect).toBe(0);
  });

  it("keeps the last question when nothing else is left", () => {
    const state = createPracticeQueue([{ id: "a" }], () => 0.5);
    expect(skipPracticeQueue(state)).toBe(state);
  });
});
