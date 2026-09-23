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

  describe("lenient policy", () => {
    it.each([
      ["hexahydrat chloridu horecnateho", "hexahydrát chloridu hořečnatého"],
      ["HEXAHYDRAT CHLORIDU HORECNATEHO", "hexahydrát chloridu hořečnatého"],
      ["hexahydratchloriduhorecnateho", "hexahydrát chloridu hořečnatého"],
      ["chlorid-chlornan vapenaty", "chlorid - chlornan vápenatý"],
      ["chlorid – chlornan vápenatý", "chlorid - chlornan vápenatý"],
      ["tetrakarbonylnikl", "tetrakarbonyl nikl"],
      ["oxid  hlinity", "oxid hlinitý"],
    ])("accepts %j for %j as a normalized match", (input, canonical) => {
      expect(evaluateAnswer(input, canonical, { policy: "lenient" })).toEqual({
        isCorrect: true,
        match: "normalized",
      });
    });

    it("still reports exact and alias matches first", () => {
      expect(evaluateAnswer(" Oxid hlinitý ", "oxid hlinitý", { policy: "lenient" })).toEqual({
        isCorrect: true,
        match: "exact",
      });
      expect(
        evaluateAnswer("kyselina boritá", "kyselina trihydrogenboritá", {
          policy: "lenient",
          aliases: ["kyselina boritá"],
        }),
      ).toEqual({ isCorrect: true, match: "alias" });
      expect(
        evaluateAnswer("kyselina borita", "kyselina trihydrogenboritá", {
          policy: "lenient",
          aliases: ["kyselina boritá"],
        }),
      ).toEqual({ isCorrect: true, match: "normalized" });
    });

    it.each([
      ["oxid dusnatý", "oxid dusný", "a different oxidation-state suffix"],
      ["chlornan sodný", "chlorid sodný", "a different anion"],
      ["siřičitan sodný", "síran sodný", "a different oxoanion"],
      ["oxid hlinit", "oxid hlinitý", "a truncated word"],
      ["oxid hlinitý sodný", "oxid hlinitý", "an extra word"],
      ["hydrát chloridu hořečnatého", "hexahydrát chloridu hořečnatého", "a missing prefix"],
      ["chloridchlornanvapenatyx", "chlorid - chlornan vápenatý", "a typo"],
      ["", "oxid hlinitý", "an empty answer"],
      ["   ", "oxid hlinitý", "only spaces"],
      ["-", "oxid hlinitý", "only a dash"],
    ])("rejects %j for %j (%s)", (input, canonical) => {
      expect(evaluateAnswer(input, canonical, { policy: "lenient" })).toEqual({
        isCorrect: false,
        match: "none",
      });
    });

    it("keeps the strict and tolerant policies unchanged", () => {
      expect(
        evaluateAnswer("hexahydratchloriduhorecnateho", "hexahydrát chloridu hořečnatého", {
          policy: "tolerant",
        }),
      ).toEqual({ isCorrect: false, match: "none" });
      expect(
        evaluateAnswer("chlorid-chlornan vápenatý", "chlorid - chlornan vápenatý", {
          policy: "strict",
        }),
      ).toEqual({ isCorrect: false, match: "none" });
    });
  });
});
