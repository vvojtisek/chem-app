import { describe, expect, it } from "vitest";

import type { AttemptEvent } from "./browser-progress-store";
import {
  calculatePeriodicTableMastery,
  MIN_MASTERY_ATTEMPTS,
  masteryForElement,
  weakestElements,
} from "./periodic-table-mastery";

function periodic(id: number, isCorrect: boolean, questionId = "element.h"): AttemptEvent {
  return {
    id: `attempt.${id}`,
    questionId,
    contentVersion: "v1",
    occurredAt: new Date(Date.UTC(2026, 8, id, 12)).toISOString(),
    isCorrect,
    round: "initial",
    mode: "periodic-table",
    direction: "name-to-symbol",
    matchPolicy: "symbol-exact",
  };
}

describe("calculatePeriodicTableMastery", () => {
  it("keeps elements with no attempts separate from low mastery", () => {
    const mastery = calculatePeriodicTableMastery([]);
    expect(masteryForElement(mastery, "element.h")).toEqual({
      level: "no-data",
      attempts: 0,
      correct: 0,
      weightedAccuracy: null,
    });
    expect(mastery.size).toBe(0);
  });

  it("does not award full mastery for one or two correct answers", () => {
    expect(MIN_MASTERY_ATTEMPTS).toBe(3);
    for (const count of [1, 2]) {
      const mastery = calculatePeriodicTableMastery(
        Array.from({ length: count }, (_, index) => periodic(index + 1, true)),
      );
      expect(masteryForElement(mastery, "element.h").level).toBe("starting");
    }
  });

  it("classifies low, developing, and mastered at the documented thresholds", () => {
    const low = calculatePeriodicTableMastery([
      periodic(1, false),
      periodic(2, false),
      periodic(3, false),
    ]);
    const developing = calculatePeriodicTableMastery([
      periodic(1, true),
      periodic(2, false),
      periodic(3, true),
    ]);
    const mastered = calculatePeriodicTableMastery([
      periodic(1, true),
      periodic(2, true),
      periodic(3, true),
    ]);
    expect(masteryForElement(low, "element.h").level).toBe("low");
    expect(masteryForElement(developing, "element.h").level).toBe("developing");
    expect(masteryForElement(mastered, "element.h").level).toBe("mastered");
  });

  it("weights recent answers more heavily regardless of input order", () => {
    const improved = [
      periodic(5, true),
      periodic(1, false),
      periodic(4, true),
      periodic(2, false),
      periodic(3, false),
    ];
    const declined = [
      periodic(1, true),
      periodic(2, true),
      periodic(3, false),
      periodic(4, false),
      periodic(5, false),
    ];
    const improvement = masteryForElement(calculatePeriodicTableMastery(improved), "element.h");
    const decline = masteryForElement(calculatePeriodicTableMastery(declined), "element.h");
    expect(improvement.level).toBe("developing");
    expect(decline.level).toBe("low");
    expect(improvement.weightedAccuracy).toBeGreaterThan(decline.weightedAccuracy ?? 0);
  });

  it("ignores other learning modes and groups by element ID", () => {
    const unrelated: AttemptEvent = {
      ...periodic(2, true),
      mode: "element-name",
      direction: "symbol-to-name",
      matchPolicy: "diacritics-tolerant",
    };
    const mastery = calculatePeriodicTableMastery([
      periodic(1, false),
      unrelated,
      periodic(3, true, "element.he"),
    ]);
    expect(masteryForElement(mastery, "element.h")).toMatchObject({ attempts: 1, correct: 0 });
    expect(masteryForElement(mastery, "element.he")).toMatchObject({ attempts: 1, correct: 1 });
  });
});

describe("weakestElements", () => {
  const answers = (questionId: string, results: readonly boolean[], offset: number) =>
    results.map((isCorrect, index) => periodic(offset + index, isCorrect, questionId));

  it("lists rated elements below mastery, weakest first, up to the limit", () => {
    const mastery = calculatePeriodicTableMastery([
      ...answers("element.mn", [true, false, false], 1),
      ...answers("element.cr", [true, false, true], 4),
      ...answers("element.fe", [true, true, true], 7),
      ...answers("element.co", [false, false], 10),
      ...answers("element.ni", [true, true, false], 12),
    ]);

    expect(weakestElements(mastery, 5).map((item) => item.elementId)).toEqual([
      "element.mn",
      "element.ni",
      "element.cr",
    ]);
    expect(weakestElements(mastery, 1).map((item) => item.elementId)).toEqual(["element.mn"]);
    expect(weakestElements(mastery, 5)[0]?.mastery).toMatchObject({ attempts: 3, correct: 1 });
  });
});
