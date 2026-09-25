import { describe, expect, it } from "vitest";
import {
  countEquationAtoms,
  gradeApprovedEquations,
  gradeEquationCoefficients,
  gradeEquationProducts,
} from "./evaluate-equation-answer";
import { parseEquationAnswer } from "./parse-equation";

const symbols = new Set(["H", "O", "C", "Zn", "Cl", "K", "Mn", "S"]);
const zinc = parseEquationAnswer("Zn + 2 HCl -> H2 + ZnCl2");
const peroxide = parseEquationAnswer(
  "5 H2O2 + 2 KMnO4 + 3 H2SO4 -> K2SO4 + 2 MnSO4 + 8 H2O + 5 O2",
);
if (!zinc || !peroxide) throw new Error("Invalid equation test fixtures.");

describe("equation answer grading", () => {
  it("accepts products in either order and blank coefficient one", () => {
    expect(gradeEquationProducts("ZnCl₂ + H₂", zinc.products, symbols)).toBe(true);
    expect(gradeEquationProducts("ZnCl2 + H2O", zinc.products, symbols)).toBe(false);
    expect(gradeEquationProducts("2 H2 + ZnCl2", zinc.products, symbols)).toBe(false);
    expect(gradeEquationCoefficients({ "reactant-1": "2" }, zinc, symbols).correct).toBe(true);
  });

  it("shows entered atom counts when coefficients are wrong", () => {
    const graded = gradeEquationCoefficients({}, zinc, symbols);
    expect(graded.correct).toBe(false);
    expect(graded.atomBalance).toEqual({
      reactants: { Zn: 1, H: 1, Cl: 1 },
      products: { H: 2, Zn: 1, Cl: 2 },
    });
    expect(gradeEquationCoefficients({ "reactant-1": "02" }, zinc, symbols).atomBalance).toBeNull();
    expect(
      gradeEquationCoefficients(
        { "reactant-0": "2", "reactant-1": "4", "product-0": "2", "product-1": "2" },
        zinc,
        symbols,
      ).correct,
    ).toBe(false);
  });

  it("marks a conserving entry that is not in the lowest ratio as balanced but not correct", () => {
    expect(
      gradeEquationCoefficients(
        { "reactant-0": "2", "reactant-1": "4", "product-0": "2", "product-1": "2" },
        zinc,
        symbols,
      ),
    ).toMatchObject({ correct: false, balanced: true });
    expect(gradeEquationCoefficients({ "reactant-1": "2" }, zinc, symbols)).toMatchObject({
      correct: true,
      balanced: true,
    });
    expect(gradeEquationCoefficients({}, zinc, symbols)).toMatchObject({
      correct: false,
      balanced: false,
    });
    expect(gradeEquationCoefficients({ "reactant-1": "x" }, zinc, symbols)).toMatchObject({
      correct: false,
      balanced: false,
      atomBalance: null,
    });
  });

  it("accepts independent reduced balancing solutions for approved formula terms", () => {
    expect(
      gradeEquationCoefficients(
        {
          "reactant-0": "7",
          "reactant-1": "2",
          "reactant-2": "3",
          "product-1": "2",
          "product-2": "10",
          "product-3": "6",
        },
        peroxide,
        symbols,
      ).correct,
    ).toBe(true);
    expect(
      gradeApprovedEquations(
        "7 H2O2 + 2 KMnO4 + 3 H2SO4 -> K2SO4 + 2 MnSO4 + 10 H2O + 6 O2",
        [peroxide],
        symbols,
      ).correct,
    ).toBe(true);
  });

  it("requires approved species, conservation and reduced coefficients for complete answers", () => {
    expect(
      gradeApprovedEquations("Zn + 2 HCl -> H2 + ZnCl2; Zn + 2 HCl → ZnCl2 + H2", [zinc], symbols)
        .correct,
    ).toBe(true);
    for (const answer of [
      "Zn + HCl -> H2 + ZnCl2",
      "2 Zn + 4 HCl -> 2 H2 + 2 ZnCl2",
      "Zn + 2 HCl -> H2 + ZnCl2 + O2",
      "Zn + 2 HCl -> H2 + ZnCl2; nonsense",
    ]) {
      expect(gradeApprovedEquations(answer, [zinc], symbols).correct).toBe(false);
    }
    expect(
      countEquationAtoms([{ coefficient: 1, formula: "Xy" }], zinc.products, symbols),
    ).toBeNull();
  });

  it("accepts only explicit notation aliases for approved terms", () => {
    const approved = {
      reactants: zinc.reactants,
      products: zinc.products.map((term) =>
        term.formula === "ZnCl2" ? { ...term, acceptedAliases: ["Zn(Cl)2"] } : term,
      ),
    };
    expect(gradeEquationProducts("H2 + Zn(Cl)2", approved.products, symbols)).toBe(true);
    expect(gradeApprovedEquations("Zn + 2 HCl -> H2 + Zn(Cl)2", [approved], symbols).correct).toBe(
      true,
    );
    expect(gradeEquationProducts("H2 + ZnCl", approved.products, symbols)).toBe(false);
  });
});
