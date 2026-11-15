import { describe, expect, it } from "vitest";

import type { AttemptEvent } from "./browser-progress-store";
import { summarizeReview } from "./review-items";

let clock = 0;
function base(isCorrect: boolean, questionId: string) {
  clock += 1;
  return {
    id: `attempt.${clock}`,
    questionId,
    contentVersion: "v1",
    occurredAt: new Date(Date.UTC(2026, 8, 1, 0, clock)).toISOString(),
    isCorrect,
    round: "initial" as const,
  };
}

function nomenclature(
  compoundId: string,
  isCorrect: boolean,
  direction: "formula-to-name" | "name-to-formula" = "formula-to-name",
): AttemptEvent {
  const common = {
    ...base(isCorrect, `${compoundId}.${direction}`),
    mode: "nomenclature" as const,
    eventSchemaVersion: 1 as const,
    sessionId: "s",
    sequence: clock,
    compoundId,
    outcome: isCorrect ? ("correct" as const) : ("incorrect" as const),
    match: isCorrect ? ("canonical" as const) : ("none" as const),
  };
  return direction === "formula-to-name"
    ? { ...common, direction, matchPolicy: "name-lenient" }
    : { ...common, direction, matchPolicy: "formula-canonical" };
}

function equation(
  questionId: string,
  isCorrect: boolean,
  level: "beginner" | "pro" = "beginner",
): AttemptEvent {
  return {
    ...base(isCorrect, questionId),
    mode: "equation",
    eventSchemaVersion: 1,
    sessionId: "s",
    sequence: clock,
    level,
    direction: level === "beginner" ? "coefficients" : "complete-equation",
    matchPolicy: "approved-balanced",
  };
}

function periodic(questionId: string, isCorrect: boolean): AttemptEvent {
  return {
    ...base(isCorrect, questionId),
    mode: "periodic-table",
    direction: "name-to-position",
    matchPolicy: "exact-position",
  };
}

function times<T>(count: number, make: () => T): T[] {
  return Array.from({ length: count }, make);
}

describe("summarizeReview", () => {
  it("is empty without rated weak items", () => {
    expect(
      summarizeReview([
        nomenclature("n.a", false),
        nomenclature("n.a", false),
        periodic("e.h", false),
      ]),
    ).toEqual({ elementIds: [], nomenclature: null, equations: null });
  });

  it("lists weak items of every exercise, weakest first", () => {
    const attempts = [
      ...times(3, () => periodic("element.na", false)),
      ...times(3, () => periodic("element.k", true)),
      nomenclature("n.b", true),
      nomenclature("n.b", false),
      nomenclature("n.b", false),
      ...times(3, () => nomenclature("n.a", false)),
      ...times(3, () => nomenclature("n.c", true)),
      ...times(3, () => equation("route.x", false)),
    ];
    expect(summarizeReview(attempts)).toEqual({
      elementIds: ["element.na"],
      nomenclature: { direction: "formula-to-name", compoundIds: ["n.a", "n.b"] },
      equations: { level: "beginner", questionIds: ["route.x"] },
    });
  });

  it("keeps one direction and one level per round, chosen by the weakest item", () => {
    const attempts = [
      ...times(3, () => nomenclature("n.a", false, "name-to-formula")),
      nomenclature("n.b", true),
      nomenclature("n.b", true),
      nomenclature("n.b", false),
      ...times(3, () => equation("product.y", false, "pro")),
      equation("route.x", true),
      equation("route.x", false),
      equation("route.x", true),
    ];
    const review = summarizeReview(attempts);
    expect(review.nomenclature).toEqual({ direction: "name-to-formula", compoundIds: ["n.a"] });
    expect(review.equations).toEqual({ level: "pro", questionIds: ["product.y"] });
  });

  it("limits the length of a round", () => {
    const attempts = ["a", "b", "c"].flatMap((id) =>
      times(3, () => nomenclature(`n.${id}`, false)),
    );
    expect(summarizeReview(attempts, 2).nomenclature?.compoundIds).toHaveLength(2);
  });
});
