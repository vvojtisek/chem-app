import { afterEach, describe, expect, it } from "vitest";

import type { AttemptEvent } from "./browser-progress-store";
import { cacheDailyGoal, countDailyAnswers, readCachedDailyGoal } from "./daily-goal";

function attempt(id: string, when: Date, isCorrect: boolean): AttemptEvent {
  return {
    id,
    questionId: "element.h",
    contentVersion: "v1",
    occurredAt: when.toISOString(),
    isCorrect,
    round: "initial",
    mode: "periodic-table",
    direction: "name-to-symbol",
    matchPolicy: "symbol-exact",
  };
}

afterEach(() => window.localStorage.clear());

describe("daily goal", () => {
  it("counts every answer in the local calendar day, including wrong answers", () => {
    const now = new Date(2026, 8, 30, 12);
    expect(
      countDailyAnswers(
        [
          attempt("a", new Date(2026, 8, 30, 1), false),
          attempt("b", new Date(2026, 8, 30, 23), true),
          attempt("c", new Date(2026, 8, 29, 23), true),
        ],
        now,
      ),
    ).toBe(2);
  });

  it("keeps the last server value isolated by account and ignores corrupt cache", () => {
    cacheDailyGoal("alice", 40);
    cacheDailyGoal("bob", null);
    expect(readCachedDailyGoal("alice")).toBe(40);
    expect(readCachedDailyGoal("bob")).toBeNull();
    window.localStorage.setItem("inorganic.daily-goal.alice", '{"schemaVersion":2,"dailyGoal":40}');
    expect(readCachedDailyGoal("alice")).toBeNull();
  });
});
