import { describe, expect, it } from "vitest";
import type { AttemptEvent } from "../browser-progress-store";
import { mapAttempt } from "./attempt-mapper";

describe("attempt mapper", () => {
  it("maps the locally validated event to the generated API shape", () => {
    const event: AttemptEvent = {
      id: "one",
      questionId: "element.h",
      contentVersion: "v1",
      occurredAt: "2026-09-23T10:00:00.000Z",
      isCorrect: true,
      round: "initial",
      mode: "nomenclature",
      eventSchemaVersion: 1,
      sessionId: "s",
      sequence: 1,
      compoundId: "c",
      outcome: "correct",
      match: "canonical",
      direction: "formula-to-name",
      matchPolicy: "name-strict",
    };
    expect(mapAttempt(event)).toEqual(event);
  });

  it("maps an equation attempt to the generated event union", () => {
    const event: AttemptEvent = {
      id: "equation-one",
      questionId: "preparation-production.route.vodik-id-20-1-preparation",
      contentVersion: "preparation-production-2026-09-24",
      occurredAt: "2026-09-24T10:00:00.000Z",
      isCorrect: true,
      round: "initial",
      mode: "equation",
      eventSchemaVersion: 1,
      sessionId: "equation-session",
      sequence: 0,
      level: "beginner",
      direction: "coefficients",
      matchPolicy: "approved-balanced",
    };
    expect(mapAttempt(event)).toEqual(event);
  });
});
