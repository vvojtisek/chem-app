import {
  curatedPreparationProduction,
  type PreparationProductionRuntimeRoute,
} from "@inorganic/content/preparation-production";
import { curatedElements } from "@inorganic/content/runtime";
import { describe, expect, it } from "vitest";

import { reactantKey } from "./preparation-production-quiz";
import {
  createReactionProductsQuestion,
  isReactionProductsAnswerCorrect,
  listProductDistractors,
  listReactionProductRoutes,
} from "./reaction-products-quiz";

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function route(
  id: string,
  reactants: readonly [number, string][],
  products: readonly [number, string][],
): PreparationProductionRuntimeRoute {
  return {
    id,
    sourceId: id,
    kind: "preparation",
    reactants: reactants.map(([coefficient, formula]) => ({ coefficient, formula })),
    products: products.map(([coefficient, formula]) => ({ coefficient, formula })),
    conditionsCs: null,
  };
}

const symbols = new Set(curatedElements.map((element) => element.symbol));
const elementsOf = (formulas: readonly string[]) =>
  new Set(formulas.flatMap((formula) => formula.match(/[A-Z][a-z]?/gu) ?? []));

const dilute = route(
  "r.no",
  [
    [3, "Cu"],
    [8, "HNO3"],
  ],
  [
    [3, "Cu(NO3)2"],
    [2, "NO"],
    [4, "H2O"],
  ],
);
const concentrated = route(
  "r.no2",
  [
    [1, "Cu"],
    [4, "HNO3"],
  ],
  [
    [1, "Cu(NO3)2"],
    [2, "NO2"],
    [2, "H2O"],
  ],
);
const hydrogen = route(
  "r.h2",
  [
    [1, "Zn"],
    [2, "HCl"],
  ],
  [
    [1, "ZnCl2"],
    [1, "H2"],
  ],
);
const oxide = route(
  "r.zno",
  [
    [2, "Zn"],
    [1, "O2"],
  ],
  [[2, "ZnO"]],
);
const routes = [dilute, concentrated, hydrogen, oxide];

describe("listProductDistractors", () => {
  it("never offers the products of another route with the same reactants", () => {
    const ids = listProductDistractors(dilute, routes, symbols).map(({ option }) => option.id);
    expect(ids).not.toContain("Cu(NO3)2+H2O+NO2");
    expect(ids).not.toContain("Cu(NO3)2+H2O+NO");
  });

  it("offers only sets whose elements differ from the reactants and are not part of the answer", () => {
    const reactantElements = elementsOf(["Zn", "HCl"]);
    const candidates = listProductDistractors(hydrogen, routes, symbols);
    expect(candidates.length).toBeGreaterThan(0);
    for (const { option } of candidates) {
      const elements = elementsOf(option.formulas);
      const same =
        elements.size === reactantElements.size &&
        [...elements].every((symbol) => reactantElements.has(symbol));
      expect(same).toBe(false);
      expect(option.formulas).not.toContain("HCl");
      expect(option.id).not.toBe("H2");
      expect(option.id).not.toBe("ZnCl2");
    }
  });

  it("ranks swaps of one product that bring in at most O or H first", () => {
    const [first] = listProductDistractors(hydrogen, routes, symbols);
    expect(first?.rank).toBe(0);
    expect(first?.option.formulas).toHaveLength(2);
  });
});

describe("createReactionProductsQuestion", () => {
  it("grades by the product set, regardless of option position", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const question = createReactionProductsQuestion(hydrogen, routes, symbols, seeded(seed));
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(question.options.map((option) => option.id)).toContain("H2+ZnCl2");
      expect(isReactionProductsAnswerCorrect(question, "H2+ZnCl2")).toBe(true);
      for (const option of question.options) {
        if (option.id !== "H2+ZnCl2") {
          expect(isReactionProductsAnswerCorrect(question, option.id)).toBe(false);
        }
      }
    }
  });

  it("places the answer at different positions across draws", () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const question = createReactionProductsQuestion(hydrogen, routes, symbols, seeded(seed));
      positions.add(question.options.findIndex((option) => option.id === question.answerId));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it("builds four sound options for every reviewed reaction in the curriculum", () => {
    const allRoutes = curatedPreparationProduction.flatMap((product) => product.routes);
    const questions = listReactionProductRoutes(curatedPreparationProduction);
    expect(questions.length).toBeGreaterThan(0);
    for (const { route: asked } of questions) {
      const question = createReactionProductsQuestion(asked, allRoutes, symbols, seeded(9));
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options.map((option) => option.id)).size).toBe(4);
      const reactantElements = elementsOf(asked.reactants.map((term) => term.formula));
      const validSets = new Set(
        allRoutes
          .filter((other) => reactantKey(other) === reactantKey(asked))
          .map((other) =>
            [...new Set(other.products.map((term) => term.formula))].sort().join("+"),
          ),
      );
      for (const option of question.options) {
        if (option.id === question.answerId) continue;
        expect(validSets.has(option.id)).toBe(false);
        const elements = elementsOf(option.formulas);
        expect(
          elements.size === reactantElements.size &&
            [...elements].every((symbol) => reactantElements.has(symbol)),
        ).toBe(false);
      }
    }
  });
});
