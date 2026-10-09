import { beforeEach, describe, expect, it } from "vitest";

import {
  BALANCING_COMPLETED_KEY,
  BALANCING_SELECTION_KEY,
  loadBalancingSelection,
  loadCompletedBalancingLessons,
  saveBalancingSelection,
  saveCompletedBalancingLessons,
} from "./balancing-preferences";

const known = new Set(["lesson.a", "lesson.b", "lesson.c"]);

beforeEach(() => window.localStorage.clear());

describe("balancing preferences", () => {
  it("restores the chosen equations, shuffle and completed markers", () => {
    saveBalancingSelection({ lessonIds: ["lesson.b", "lesson.a"], shuffle: true });
    saveCompletedBalancingLessons(["lesson.c"]);

    expect(loadBalancingSelection(known)).toEqual({
      lessonIds: ["lesson.b", "lesson.a"],
      shuffle: true,
    });
    expect(loadCompletedBalancingLessons(known)).toEqual(["lesson.c"]);
    expect(JSON.parse(window.localStorage.getItem(BALANCING_SELECTION_KEY) ?? "null")).toEqual({
      schemaVersion: 1,
      lessonIds: ["lesson.b", "lesson.a"],
      shuffle: true,
    });
  });

  it("drops ids of equations that are no longer in the curriculum and duplicates", () => {
    saveBalancingSelection({
      lessonIds: ["lesson.a", "lesson.removed", "lesson.a"],
      shuffle: false,
    });
    saveCompletedBalancingLessons(["lesson.removed", "lesson.b"]);

    expect(loadBalancingSelection(known)?.lessonIds).toEqual(["lesson.a"]);
    expect(loadCompletedBalancingLessons(known)).toEqual(["lesson.b"]);
  });

  it.each([
    ["corrupt JSON", "{"],
    [
      "an unknown schema version",
      JSON.stringify({ schemaVersion: 2, lessonIds: [], shuffle: false }),
    ],
    ["non-string ids", JSON.stringify({ schemaVersion: 1, lessonIds: [1], shuffle: false })],
  ])("ignores %s", (_, raw) => {
    window.localStorage.setItem(BALANCING_SELECTION_KEY, raw);
    window.localStorage.setItem(BALANCING_COMPLETED_KEY, raw);

    expect(loadBalancingSelection(known)).toBeNull();
    expect(loadCompletedBalancingLessons(known)).toEqual([]);
  });
});
