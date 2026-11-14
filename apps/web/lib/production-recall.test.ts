import { gradeProductSlots, gradeRouteSlots } from "@inorganic/chemistry";
import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import { curatedElements } from "@inorganic/content/runtime";
import { describe, expect, it } from "vitest";

import {
  countProductionChoiceQuestions,
  countProductionRecallQuestions,
  createProductionChoiceQuiz,
  createProductionRecall,
  type ProductionRecallQuestion,
} from "./production-recall";

const symbols = new Set(curatedElements.map((element) => element.symbol));
const formulas = (terms: readonly { readonly formula: string }[]) => [
  ...new Set(terms.map((term) => term.formula)),
];

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

  it("grades the reviewed products of every route as correct, one formula per slot", () => {
    for (const question of all("products")) {
      if (question.mode !== "products") throw new Error("expected products");
      const slots = formulas(question.route.products).reverse();
      const result = gradeProductSlots(slots, question.route.products, symbols);
      expect(result.status === "graded" && result.correct, question.id).toBe(true);
    }
  });

  it("accepts every reviewed route of a substance, with or without coefficients", () => {
    for (const question of all("equation")) {
      if (question.mode !== "equation") throw new Error("expected equation");
      expect(question.routes).toContain(question.hintRoute);
      for (const route of question.routes) {
        expect(route.products.map((term) => term.formula)).toContain(question.product.formula);
        const bare = gradeRouteSlots(
          formulas(route.reactants),
          formulas(route.products),
          question.routes,
          symbols,
        );
        expect(bare.status === "graded" && bare.correct, route.id).toBe(true);
        const withNumbers = gradeRouteSlots(
          route.reactants.map((term) => `${term.coefficient} ${term.formula}`),
          route.products.map((term) => `${term.coefficient} ${term.formula}`),
          question.routes,
          symbols,
        );
        expect(withNumbers, route.id).toMatchObject({ correct: true });
      }
    }
  });
});

describe("Lehká product-set questions", () => {
  it("offers the reviewed product set and distractors that cannot be it", () => {
    const quiz = createProductionChoiceQuiz(
      curatedPreparationProduction,
      { kind: "all", count: null },
      symbols,
      () => 0.5,
    );
    expect(quiz).toHaveLength(
      countProductionChoiceQuestions(curatedPreparationProduction, "all", symbols),
    );
    expect(quiz.length).toBeGreaterThan(50);
    for (const question of quiz) {
      expect(question.options.length, question.id).toBeGreaterThanOrEqual(2);
      const answer = question.options.find((option) => option.id === question.answerId);
      expect([...(answer?.formulas ?? [])].sort(), question.id).toEqual(
        formulas(question.route.products).sort(),
      );
      expect(new Set(question.options.map((option) => option.id)).size).toBe(
        question.options.length,
      );
    }
  });
});
