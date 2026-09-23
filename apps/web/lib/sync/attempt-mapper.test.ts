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
});
