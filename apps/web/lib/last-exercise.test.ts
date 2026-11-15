import { describe, expect, it } from "vitest";

import type { AttemptEvent } from "./browser-progress-store";
import { findLastExercise } from "./last-exercise";

function periodic(minute: number, direction: "name-to-position" | "name-to-symbol"): AttemptEvent {
  return {
    id: `attempt.${minute}`,
    questionId: "element.h",
    contentVersion: "v1",
    occurredAt: new Date(Date.UTC(2026, 8, 1, 0, minute)).toISOString(),
    isCorrect: true,
    round: "initial",
    mode: "periodic-table",
    ...(direction === "name-to-position"
      ? { direction, matchPolicy: "exact-position" as const }
      : { direction, matchPolicy: "symbol-exact" as const }),
  };
}

describe("findLastExercise", () => {
  it("is null without attempts", () => {
    expect(findLastExercise([])).toBeNull();
  });

  it("opens the exercise of the newest attempt", () => {
    expect(
      findLastExercise([periodic(5, "name-to-position"), periodic(2, "name-to-symbol")]),
    ).toEqual({
      title: "Slepá periodická tabulka",
      href: "/procvicovani/periodicka-tabulka",
      occurredAt: "2026-09-01T00:05:00.000Z",
    });
    expect(
      findLastExercise([periodic(1, "name-to-position"), periodic(2, "name-to-symbol")])?.href,
    ).toBe("/procvicovani/prvky");
  });
});
