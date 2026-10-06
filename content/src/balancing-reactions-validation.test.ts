import { describe, expect, it } from "vitest";
import { curatedBalancingReactionLessons } from "./balancing-reactions-runtime";
import { findBalancingReactionProblems } from "./balancing-reactions-validation";
import { curatedElements } from "./runtime";

const allowedSymbols = new Set(curatedElements.map((element) => element.symbol));

describe("balancing reaction validation", () => {
  it("requires every lesson to conclude with a structured final conservation summary", () => {
    for (const lesson of curatedBalancingReactionLessons) {
      const final = lesson.steps.at(-1);
      expect(final?.kind, lesson.id).toBe("summary");
      expect(
        final?.balanceLedger?.atoms?.every((atom) => atom.reactants === atom.products),
        lesson.id,
      ).toBe(true);
      if (final?.balanceLedger?.charge)
        expect(final.balanceLedger.charge.reactants, lesson.id).toBe(
          final.balanceLedger.charge.products,
        );
    }
    const lesson = curatedBalancingReactionLessons[0];
    if (!lesson) throw new Error("Missing reference lesson");
    expect(
      findBalancingReactionProblems(
        [{ ...lesson, steps: lesson.steps.slice(0, -1) }],
        allowedSymbols,
      ),
    ).toContainEqual({ code: "missing_final_summary", recordId: lesson.id });
  });

  it("derives the coupled hydroxide/water coefficients in the arsenic example", () => {
    const lesson = curatedBalancingReactionLessons.find(
      (lesson) => lesson.id === "reaction.balancing.cat-1-06",
    );
    expect(lesson?.steps).toHaveLength(6);
    expect(lesson?.steps[2]?.explanation).toContain("x = 3 + y");
    expect(lesson?.steps[3]?.explanation).toContain("x = 2y");
    expect(lesson?.steps[3]?.equation.reactants[1]?.coefficient).toBe(6);
    expect(lesson?.steps[3]?.equation.products.at(-1)?.coefficient).toBe(1);
    expect(lesson?.steps[4]?.equation.products.at(-1)?.coefficient).toBe(3);
    expect(lesson?.steps[4]?.balanceLedger?.atoms).toContainEqual({
      element: "O",
      reactants: 6,
      products: 6,
    });
  });
  it("accepts all imported lessons and their intermediate ledgers", () => {
    expect(curatedBalancingReactionLessons).toHaveLength(114);
    expect(
      curatedBalancingReactionLessons.reduce<Record<number, number>>((counts, lesson) => {
        counts[lesson.category] = (counts[lesson.category] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({ 1: 12, 2: 31, 3: 31, 4: 18, 5: 13, 6: 9 });
    expect(findBalancingReactionProblems(curatedBalancingReactionLessons, allowedSymbols)).toEqual(
      [],
    );
  });

  it("preserves the slide sequence and every intermediate iodine/charge count", () => {
    const lesson = curatedBalancingReactionLessons.find(
      (candidate) => candidate.id === "reaction.balancing.iodine-synproportionation",
    );
    expect(
      lesson?.steps
        .slice(2, 7)
        .map((step) => [
          ...step.equation.reactants.map((term) => term.coefficient),
          ...step.equation.products.map((term) => term.coefficient),
        ]),
    ).toEqual([
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 6, 1, 1],
      [1, 5, 6, 1, 1],
      [1, 5, 6, 3, 1],
    ]);
    expect(lesson?.steps.slice(2, 7).map((step) => step.balanceLedger?.charge?.reactants)).toEqual([
      -1, -1, 4, 0, 0,
    ]);
    expect(lesson?.steps).toHaveLength(14);
    expect(lesson?.steps[12]?.balanceLedger?.charge).toEqual({ reactants: -3, products: -3 });
    expect(lesson?.steps.at(-1)?.kind).toBe("summary");
    expect(lesson?.steps.at(-1)?.balanceLedger?.charge).toEqual({ reactants: 0, products: 0 });
  });

  it("rejects a lesson with a charge-imbalanced final step", () => {
    const iodineLesson = curatedBalancingReactionLessons.find(
      (lesson) => lesson.id === "reaction.balancing.iodine-synproportionation",
    );
    if (!iodineLesson) throw new Error("Missing iodine reference lesson.");
    const lastStep = iodineLesson.steps.at(-1);
    if (!lastStep) throw new Error("Missing iodine final step.");
    const broken = {
      ...iodineLesson,
      steps: [
        ...iodineLesson.steps.slice(0, -1),
        {
          ...lastStep,
          equation: {
            ...lastStep.equation,
            reactants: lastStep.equation.reactants.map((term) =>
              term.formula === "H" ? { ...term, coefficient: 5 } : term,
            ),
          },
        },
      ],
    };

    expect(findBalancingReactionProblems([broken], allowedSymbols)).toContainEqual({
      code: "unbalanced_charge",
      recordId: iodineLesson.id,
    });
  });
});
