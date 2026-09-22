import { describe, expect, it } from "vitest";
import { evaluateAnswer } from "./evaluate-answer";

describe("evaluateAnswer", () => {
  it("matches case, spacing, and Unicode composition exactly", () =>
    expect(evaluateAnswer("  Vodi\u0301k ", "Vodík", { policy: "strict" })).toEqual({
      isCorrect: true,
      match: "exact",
    }));
  it("accepts missing diacritics only in tolerant policy", () => {
    expect(evaluateAnswer("vodik", "Vodík", { policy: "tolerant" })).toEqual({
      isCorrect: true,
      match: "missing-diacritics",
    });
    expect(evaluateAnswer("vodik", "Vodík", { policy: "strict" })).toEqual({
      isCorrect: false,
      match: "none",
    });
  });
  it("accepts only approved aliases", () =>
    expect(
      evaluateAnswer("Hydrogen", "Vodík", { policy: "strict", aliases: ["Hydrogen"] }),
    ).toEqual({ isCorrect: true, match: "alias" }));
  it("rejects chemically different answers", () =>
    expect(evaluateAnswer("Dusík", "Dusičnan", { policy: "tolerant" })).toEqual({
      isCorrect: false,
      match: "none",
    }));
});
