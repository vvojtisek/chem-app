import { describe, expect, it } from "vitest";
import {
  hasReducedEquationCoefficients,
  isBalancedEquation,
  parseEquationAnswer,
  parseEquationFormula,
  parseEquationTerms,
} from "./parse-equation";

const symbols = new Set(["H", "O", "C", "Zn", "Cl", "K", "Mn", "S"]);

describe("equation parsing", () => {
  it("parses complete equations, arrow variants, subscripts and nested groups", () => {
    expect(parseEquationAnswer("Zn + 2 HCl → H₂ + ZnCl₂")).toEqual({
      reactants: [
        { coefficient: 1, formula: "Zn" },
        { coefficient: 2, formula: "HCl" },
      ],
      products: [
        { coefficient: 1, formula: "H2" },
        { coefficient: 1, formula: "ZnCl2" },
      ],
    });
    expect(parseEquationFormula("K2[Mn(SO4)2]", symbols)?.atomCounts).toEqual({
      K: 2,
      Mn: 1,
      S: 2,
      O: 8,
    });
  });

  it.each([
    "Zn + 2 HCl -> H2 + ZnCl2 -> H2",
    "Zn + -> H2",
    "Zn + 0 HCl -> H2",
    "Zn + 02 HCl -> H2",
    "Zn + (HCl -> H2",
    "Zn + HCl = H2 + ZnCl2",
  ])("rejects malformed complete equation %s", (input) => {
    expect(parseEquationAnswer(input)).toBeNull();
  });

  it("rejects unknown symbols, invalid capitalization, subscripts and partial formulas", () => {
    for (const input of ["Xy2", "h2O", "H02O", "H2O)", "(H2O", "H0O", "H2O garbage"]) {
      expect(parseEquationFormula(input, symbols)).toBeNull();
    }
    expect(parseEquationTerms("H2 + ")).toBeNull();
  });

  it("distinguishes conserved, unbalanced and non-reduced equations", () => {
    const balanced = parseEquationAnswer("2 H2 + O2 -> 2 H2O");
    const unbalanced = parseEquationAnswer("H2 + O2 -> H2O");
    const nonReduced = parseEquationAnswer("4 H2 + 2 O2 -> 4 H2O");
    expect(balanced && isBalancedEquation(balanced.reactants, balanced.products, symbols)).toBe(
      true,
    );
    expect(
      unbalanced && isBalancedEquation(unbalanced.reactants, unbalanced.products, symbols),
    ).toBe(false);
    expect(
      nonReduced && hasReducedEquationCoefficients(nonReduced.reactants, nonReduced.products),
    ).toBe(false);
  });
});
