import {
  curatedPreparationProduction,
  type PreparationProductionRuntimeProduct,
  type PreparationProductionRuntimeRoute,
} from "@inorganic/content/preparation-production";
import { describe, expect, it } from "vitest";

import {
  createProductionQuiz,
  createProductionQuizQuestion,
  excludedDistractorFormulas,
  isProductionQuizAnswerCorrect,
  listProductionQuizRoutes,
} from "./preparation-production-quiz";

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function route(
  id: string,
  kind: PreparationProductionRuntimeRoute["kind"],
  reactants: readonly [number, string][],
  products: readonly [number, string][],
): PreparationProductionRuntimeRoute {
  return {
    id,
    sourceId: id,
    kind,
    reactants: reactants.map(([coefficient, formula]) => ({ coefficient, formula })),
    products: products.map(([coefficient, formula]) => ({ coefficient, formula })),
    conditionsCs: null,
  };
}

function product(
  id: string,
  nameCs: string,
  formula: string,
  routes: readonly PreparationProductionRuntimeRoute[] = [],
): PreparationProductionRuntimeProduct {
  return {
    id,
    nameCs,
    formula,
    notes: [],
    routes,
    reviewLevel: "owner-approved",
    sources: [],
  };
}

const nitricOxide = product("p.no", "Oxid dusnatý", "NO", [
  route(
    "r.no",
    "preparation",
    [
      [3, "Cu"],
      [8, "HNO3"],
    ],
    [
      [3, "Cu(NO3)2"],
      [2, "NO"],
      [4, "H2O"],
    ],
  ),
]);
const nitrogenDioxide = product("p.no2", "Oxid dusičitý", "NO2", [
  route(
    "r.no2",
    "preparation",
    [
      [1, "Cu"],
      [4, "HNO3"],
    ],
    [
      [1, "Cu(NO3)2"],
      [2, "NO2"],
      [2, "H2O"],
    ],
  ),
]);
const ammonia = product("p.nh3", "Amoniak", "NH3", [
  route(
    "r.nh3",
    "manufacture",
    [
      [1, "N2"],
      [3, "H2"],
    ],
    [[2, "NH3"]],
  ),
  // Listed under ammonia, but ammonia is not its product, so it is never asked.
  route(
    "r.nh3-oxidation",
    "manufacture",
    [
      [4, "NH3"],
      [5, "O2"],
    ],
    [
      [4, "NO"],
      [6, "H2O"],
    ],
  ),
]);
const water = product("p.h2o", "Voda", "H2O");
const copper = product("p.cu", "Měď", "Cu");
const hydrogen = product("p.h2", "Vodík", "H2");
const chlorine = product("p.cl2", "Chlor", "Cl2");
const sodium = product("p.na", "Sodík", "Na");
const iron = product("p.fe", "Železo", "Fe");

const products = [
  nitricOxide,
  nitrogenDioxide,
  ammonia,
  water,
  copper,
  hydrogen,
  chlorine,
  sodium,
  iron,
];

describe("listProductionQuizRoutes", () => {
  it("keeps only routes that make their own product", () => {
    expect(listProductionQuizRoutes(products).map(({ route }) => route.id)).toEqual([
      "r.no",
      "r.no2",
      "r.nh3",
    ]);
  });

  it("asks a product's identically written routes once", () => {
    const [ammoniaRoute] = ammonia.routes;
    if (!ammoniaRoute) throw new Error("fixture");
    const twice = product("p.nh3", "Amoniak", "NH3", [
      ammoniaRoute,
      { ...ammoniaRoute, id: "r.nh3-second-source", sourceId: "second" },
    ]);

    expect(listProductionQuizRoutes([twice]).map(({ route }) => route.id)).toEqual(["r.nh3"]);
  });

  it("filters by route kind", () => {
    expect(listProductionQuizRoutes(products, "manufacture").map(({ route }) => route.id)).toEqual([
      "r.nh3",
    ]);
    expect(listProductionQuizRoutes(products, "preparation")).toHaveLength(2);
  });
});

describe("excludedDistractorFormulas", () => {
  it("excludes every substance of the route and the products of routes with the same reactants", () => {
    const [noRoute] = nitricOxide.routes;
    if (!noRoute) throw new Error("fixture");
    const excluded = excludedDistractorFormulas(noRoute, products);

    expect([...excluded].sort()).toEqual(["Cu", "Cu(NO3)2", "H2O", "HNO3", "NO", "NO2"]);
  });

  it("does not exclude products of routes with different reactants", () => {
    const [ammoniaRoute] = ammonia.routes;
    if (!ammoniaRoute) throw new Error("fixture");
    const excluded = excludedDistractorFormulas(ammoniaRoute, products);

    expect(excluded.has("NO")).toBe(false);
    expect(excluded.has("Cl2")).toBe(false);
    expect(excluded.has("H2")).toBe(true);
  });
});

describe("createProductionQuizQuestion", () => {
  it("never offers a distractor that is also made from the same reactants", () => {
    const [noRoute] = nitricOxide.routes;
    if (!noRoute) throw new Error("fixture");
    for (let seed = 1; seed <= 50; seed += 1) {
      const question = createProductionQuizQuestion(
        { product: nitricOxide, route: noRoute },
        products,
        seeded(seed),
      );
      const formulas = question.options.map((option) => option.formula);
      expect(formulas).toContain("NO");
      expect(formulas).not.toContain("NO2");
      expect(formulas).not.toContain("Cu");
      expect(formulas).not.toContain("H2O");
      expect(question.options).toHaveLength(4);
    }
  });

  it("grades by product ID", () => {
    const [noRoute] = nitricOxide.routes;
    if (!noRoute) throw new Error("fixture");
    const question = createProductionQuizQuestion(
      { product: nitricOxide, route: noRoute },
      products,
      seeded(7),
    );

    expect(isProductionQuizAnswerCorrect(question, "p.no")).toBe(true);
    expect(isProductionQuizAnswerCorrect(question, "p.no2")).toBe(false);
    expect(isProductionQuizAnswerCorrect(question, "Oxid dusnatý")).toBe(false);
  });
});

describe("createProductionQuiz", () => {
  it("is deterministic for a seed and honours the question count", () => {
    const first = createProductionQuiz(products, { kind: "all", count: 2 }, seeded(3));
    const second = createProductionQuiz(products, { kind: "all", count: 2 }, seeded(3));

    expect(first).toHaveLength(2);
    expect(first).toEqual(second);
  });

  it("builds a sound question for every reviewed route in the curriculum", () => {
    const quiz = createProductionQuiz(
      curatedPreparationProduction,
      { kind: "all", count: null },
      seeded(11),
    );

    expect(quiz.length).toBe(listProductionQuizRoutes(curatedPreparationProduction).length);
    expect(new Set(quiz.map((question) => question.id)).size).toBe(quiz.length);
    for (const question of quiz) {
      const excluded = excludedDistractorFormulas(question.route, curatedPreparationProduction);
      const distractors = question.options.filter((option) => option.id !== question.answer.id);
      expect(question.options).toHaveLength(4);
      expect(question.route.products.map((term) => term.formula)).toContain(
        question.answer.formula,
      );
      for (const option of distractors) expect(excluded.has(option.formula)).toBe(false);
    }
  });
});
