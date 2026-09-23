import { describe, expect, it } from "vitest";

import { evaluateElementAnswer } from "./evaluate-element-answer";

const sodium = { nameCs: "Sodík", symbol: "Na" };

describe("evaluateElementAnswer", () => {
  it.each([
    ["sodík", "name"],
    ["  Sodík ", "name"],
    ["sodik", "name-missing-diacritics"],
    ["Na", "symbol"],
    [" Na ", "symbol"],
  ] as const)("accepts %j as %s", (input, match) => {
    expect(evaluateElementAnswer(input, sodium)).toEqual({ isCorrect: true, match });
  });

  it.each(["na", "NA", "nA"])(
    "rejects the wrongly capitalized symbol %j with an explanation",
    (input) => {
      expect(evaluateElementAnswer(input, sodium)).toEqual({
        isCorrect: false,
        match: "symbol-case-mismatch",
      });
    },
  );

  it.each([
    ["N", "a different element's symbol"],
    ["Draslík", "a different element's name"],
    ["Sodk", "a typo"],
    ["NaCl", "a compound formula"],
    ["N a", "a symbol with inner spacing"],
    ["", "an empty answer"],
  ])("rejects %j (%s)", (input) => {
    expect(evaluateElementAnswer(input, sodium)).toEqual({ isCorrect: false, match: "none" });
  });
});
