import { describe, expect, it } from "vitest";

import { curatedElements } from "./runtime";
import { curatedBalancingReactionLessons } from "./balancing-reactions-runtime";
import { findBalancingReactionProblems } from "./balancing-reactions-validation";

const allowedSymbols = new Set(curatedElements.map((element) => element.symbol));

describe("balancing reaction validation", () => {
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
