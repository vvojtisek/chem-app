import { gradeEquationRecall, gradeProductRecall } from "@inorganic/chemistry";
import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import { curatedElements } from "@inorganic/content/runtime";
import { describe, expect, it } from "vitest";

import {
  countProductionRecallQuestions,
  createProductionRecall,
  type ProductionRecallQuestion,
} from "./production-recall";

const symbols = new Set(curatedElements.map((element) => element.symbol));
const formulas = (terms: readonly { readonly formula: string }[]) =>
  terms.map((term) => term.formula).join(" + ");

function all(mode: "products" | "equation"): readonly ProductionRecallQuestion[] {
  return createProductionRecall(
    curatedPreparationProduction,
    mode,
    { kind: "all", count: null },
    () => 0.5,
  );
}

describe("production recall questions", () => {
  it("asks every eligible route and every substance and kind once", () => {
    const products = all("products");
    const equations = all("equation");
    expect(products).toHaveLength(
      countProductionRecallQuestions(curatedPreparationProduction, "all", "products"),
    );
    expect(equations).toHaveLength(
      countProductionRecallQuestions(curatedPreparationProduction, "all", "equation"),
    );
    expect(new Set(products.map((question) => question.id)).size).toBe(products.length);
    expect(new Set(equations.map((question) => question.id)).size).toBe(equations.length);
  });

  it("grades the reviewed products of every route as correct without coefficients", () => {
    for (const question of all("products")) {
      if (question.mode !== "products") throw new Error("expected products");
      const result = gradeProductRecall(
        formulas(question.route.products),
        question.route.products,
        symbols,
      );
      expect(result.status === "graded" && result.correct, question.id).toBe(true);
    }
  });

  it("accepts every reviewed route of a substance, with or without coefficients", () => {
    for (const question of all("equation")) {
      if (question.mode !== "equation") throw new Error("expected equation");
      expect(question.routes).toContain(question.hintRoute);
      for (const route of question.routes) {
        expect(route.products.map((term) => term.formula)).toContain(question.product.formula);
        const bare = gradeEquationRecall(
          `${formulas(route.reactants)} -> ${formulas(route.products)}`,
          question.routes,
          symbols,
        );
        expect(bare.status === "graded" && bare.correct, route.id).toBe(true);
        const side = (terms: typeof route.reactants) =>
          terms.map((term) => `${term.coefficient} ${term.formula}`).join(" + ");
        const balanced = gradeEquationRecall(
          `${side(route.reactants)} -> ${side(route.products)}`,
          question.routes,
          symbols,
        );
        expect(balanced, route.id).toMatchObject({ correct: true });
      }
    }
  });
});
