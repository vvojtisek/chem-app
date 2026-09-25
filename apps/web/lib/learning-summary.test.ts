import { describe, expect, it } from "vitest";

import type { AttemptEvent } from "./browser-progress-store";
import { summarizeAreas } from "./learning-summary";

const base = { contentVersion: "v1", round: "initial" as const };

const attempts: readonly AttemptEvent[] = [
  {
    ...base,
    id: "a.1",
    questionId: "element.h",
    occurredAt: "2026-09-20T08:00:00.000Z",
    isCorrect: true,
    mode: "periodic-table",
    direction: "name-to-position",
    matchPolicy: "exact-position",
  },
  {
    ...base,
    id: "a.2",
    questionId: "element.he",
    occurredAt: "2026-09-20T08:01:00.000Z",
    isCorrect: false,
    mode: "element-name",
    direction: "symbol-to-name",
    matchPolicy: "diacritics-tolerant",
  },
  {
    ...base,
    id: "a.3",
    questionId: "nomenclature.nacl.formula-to-name",
    occurredAt: "2026-09-20T08:02:00.000Z",
    isCorrect: true,
    mode: "nomenclature",
    eventSchemaVersion: 1,
    sessionId: "s.1",
    sequence: 0,
    compoundId: "nomenclature.nacl",
    outcome: "correct",
    match: "canonical",
    direction: "formula-to-name",
    matchPolicy: "name-lenient",
  },
  {
    ...base,
    id: "a.4",
    questionId: "preparation-production.route.h2",
    occurredAt: "2026-09-20T08:03:00.000Z",
    isCorrect: false,
    mode: "equation",
    eventSchemaVersion: 1,
    sessionId: "s.2",
    sequence: 0,
    level: "beginner",
    direction: "coefficients",
    matchPolicy: "approved-balanced",
  },
];

describe("summarizeAreas", () => {
  it("counts answers per practice area, with both element modes under the periodic table", () => {
    expect(summarizeAreas(attempts)).toEqual({
      periodic: { attempts: 2, correct: 1 },
      nomenclature: { attempts: 1, correct: 1 },
      equations: { attempts: 1, correct: 0 },
    });
  });

  it("starts every area at zero", () => {
    expect(summarizeAreas([])).toEqual({
      periodic: { attempts: 0, correct: 0 },
      nomenclature: { attempts: 0, correct: 0 },
      equations: { attempts: 0, correct: 0 },
    });
  });
});
