import { describe, expect, it } from "vitest";

import { evaluateElementAnswer } from "./evaluate-element-answer";

const sodium = { nameCs: "Sodík", symbol: "Na" };
const beryllium = { nameCs: "Beryllium", symbol: "Be" };

describe("evaluateElementAnswer for a symbol", () => {
  it.each(["Na", " Na ", "\tNa\n"])("accepts the exact symbol %j", (input) => {
    expect(evaluateElementAnswer(input, sodium, "symbol")).toEqual({
      isCorrect: true,
      match: "symbol",
    });
  });

  it.each(["na", "NA", "nA"])(
    "rejects the wrongly capitalized symbol %j with an explanation",
    (input) => {
      expect(evaluateElementAnswer(input, sodium, "symbol")).toEqual({
        isCorrect: false,
        match: "symbol-case-mismatch",
      });
    },
  );

  it.each([
    ["Sodík", "the Czech name instead of the symbol"],
    ["sodik", "the name without diacritics"],
    ["N", "a different element's symbol"],
    ["K", "the symbol of a chemically similar element"],
    ["NaCl", "a compound formula"],
    ["N a", "a symbol with inner spacing"],
    ["Na.", "a symbol with punctuation"],
    ["", "an empty answer"],
  ])("rejects %j (%s)", (input) => {
    expect(evaluateElementAnswer(input, sodium, "symbol")).toEqual({
      isCorrect: false,
      match: "none",
    });
  });
});

describe("evaluateElementAnswer for a Czech name", () => {
  it.each([
    ["Sodík", "name"],
    ["sodík", "name"],
    ["  Sodík ", "name"],
    ["SODÍK", "name"],
    ["sodik", "name-missing-diacritics"],
  ] as const)("accepts %j as %s", (input, match) => {
    expect(evaluateElementAnswer(input, sodium, "name")).toEqual({ isCorrect: true, match });
  });

  it("accepts the reviewed spelling beryllium and rejects the variant with one l", () => {
    expect(evaluateElementAnswer("beryllium", beryllium, "name")).toEqual({
      isCorrect: true,
      match: "name",
    });
    expect(evaluateElementAnswer("berylium", beryllium, "name")).toEqual({
      isCorrect: false,
      match: "none",
    });
  });

  it.each([
    ["Na", "the symbol instead of the name"],
    ["Natrium", "the Latin name"],
    ["Draslík", "a different element's name"],
    ["Sodk", "a typo"],
    ["Sodík sodný", "extra words"],
    ["", "an empty answer"],
  ])("rejects %j (%s)", (input) => {
    expect(evaluateElementAnswer(input, sodium, "name")).toEqual({
      isCorrect: false,
      match: "none",
    });
  });
});
