import { describe, expect, it } from "vitest";

import {
  gradeEquationRecall,
  gradeProductRecall,
  readRecallEquation,
  readRecallTerms,
} from "./evaluate-reaction-recall";
import { parseEquationAnswer } from "./parse-equation";

const symbols = new Set(["H", "O", "N", "P", "C", "Ca", "Zn", "Cl", "S"]);

function equation(text: string) {
  const parsed = parseEquationAnswer(text);
  if (!parsed) throw new Error(`Invalid fixture: ${text}`);
  return parsed;
}

const zincHcl = equation("Zn + 2 HCl -> ZnCl2 + H2");
const zincSulfuric = equation("Zn + H2SO4 -> ZnSO4 + H2");
const hydride = equation("CaH2 + 2 H2O -> Ca(OH)2 + 2 H2");
const phosphorus = equation("P + 5 HNO3 -> H3PO4 + 5 NO2 + H2O");

describe("product recall", () => {
  it("accepts the products in any order, with or without coefficients", () => {
    for (const input of ["ZnCl2 + H2", "H2 + ZnCl2", "H₂ + ZnCl₂", "ZnCl2 + 1 H2", "H2, ZnCl2"]) {
      const result = gradeProductRecall(input, zincHcl.products, symbols);
      expect(result.status === "graded" && result.correct, input).toBe(true);
    }
    const nitric = gradeProductRecall("H3PO4 + NO2 + H2O", phosphorus.products, symbols);
    expect(nitric.status === "graded" && nitric.correct).toBe(true);
    const withNumbers = gradeProductRecall("H3PO4 + 5 NO2 + H2O", phosphorus.products, symbols);
    expect(withNumbers.status === "graded" && withNumbers.correct).toBe(true);
  });

  it("is case-sensitive and compares notation, not atom counts", () => {
    for (const input of ["zncl2 + H2", "Cl2Zn + H2", "ZnCl2 + h2"]) {
      const result = gradeProductRecall(input, zincHcl.products, symbols);
      expect(result.status === "graded" && result.correct, input).toBe(false);
    }
  });

  it("marks wrong, duplicate and missing products", () => {
    const result = gradeProductRecall("ZnCl2 + ZnCl2 + H2O", zincHcl.products, symbols);
    expect(result).toMatchObject({
      status: "graded",
      correct: false,
      missingCount: 1,
      terms: [
        { formula: "ZnCl2", verdict: "correct" },
        { formula: "ZnCl2", verdict: "duplicate" },
        { formula: "H2O", verdict: "wrong" },
      ],
    });
  });

  it("asks for a fix instead of grading an unreadable entry", () => {
    for (const input of ["", "ZnCl2 +", "ZnCl2 + H2 -> x", "ZnCl2 & H2", "Zn(Cl2 + H2"]) {
      expect(gradeProductRecall(input, zincHcl.products, symbols), input).toEqual({
        status: "unreadable",
      });
    }
    expect(readRecallTerms("2 HCl + Zn")).toEqual([
      { coefficient: 2, formula: "HCl" },
      { coefficient: 1, formula: "Zn" },
    ]);
  });
});

describe("equation recall", () => {
  const hydrogen = [zincHcl, zincSulfuric, hydride];

  it("reads -> , → and = as the arrow", () => {
    for (const input of [
      "Zn + HCl -> ZnCl2 + H2",
      "Zn + HCl → ZnCl2 + H2",
      "Zn + HCl = ZnCl2 + H2",
    ]) {
      expect(readRecallEquation(input), input).not.toBeNull();
    }
    expect(readRecallEquation("Zn + HCl ZnCl2 + H2")).toBeNull();
    expect(readRecallEquation("Zn -> HCl -> H2")).toBeNull();
  });

  it("accepts any reviewed route and fills in its coefficients when none are written", () => {
    const result = gradeEquationRecall("CaH2 + H2O -> H2 + Ca(OH)2", hydrogen, symbols);
    expect(result).toMatchObject({ status: "graded", correct: true, coefficients: "omitted" });
    expect(result.status === "graded" ? result.route : null).toBe(hydride);
    const sulfuric = gradeEquationRecall("H2SO4 + Zn = ZnSO4 + H2", hydrogen, symbols);
    expect(sulfuric.status === "graded" ? sulfuric.route : null).toBe(zincSulfuric);
  });

  it("accepts the reviewed coefficients and rejects other written ones", () => {
    expect(gradeEquationRecall("Zn + 2 HCl -> ZnCl2 + H2", hydrogen, symbols)).toMatchObject({
      correct: true,
      coefficients: "matched",
    });
    expect(gradeEquationRecall("Zn + 3 HCl -> ZnCl2 + H2", hydrogen, symbols)).toMatchObject({
      correct: false,
      coefficients: "unbalanced",
    });
    expect(gradeEquationRecall("2 Zn + 4 HCl -> 2 ZnCl2 + 2 H2", hydrogen, symbols)).toMatchObject({
      correct: false,
      coefficients: "unreduced",
    });
  });

  it("rejects a pathway that is not reviewed for the substance", () => {
    const result = gradeEquationRecall("Zn + H2O -> ZnO + H2", hydrogen, symbols);
    expect(result).toMatchObject({ status: "graded", correct: false, route: null });
    if (result.status !== "graded") throw new Error("expected graded");
    expect(result.reactants.terms.map((term) => term.verdict)).toEqual(["correct", "wrong"]);
  });

  it("does not let a product stand in for a reactant", () => {
    const result = gradeEquationRecall("ZnCl2 + H2 -> Zn + HCl", hydrogen, symbols);
    expect(result).toMatchObject({ correct: false, route: null });
  });
});
