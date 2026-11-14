import { describe, expect, it } from "vitest";

import {
  gradeProductSlots,
  gradeRouteSlots,
  readRecallSlot,
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

describe("slot reading", () => {
  it("reads one formula per slot and ignores a leading coefficient", () => {
    expect(readRecallSlot("ZnCl2")).toEqual({ coefficient: 1, formula: "ZnCl2" });
    expect(readRecallSlot("2 HCl")).toEqual({ coefficient: 2, formula: "HCl" });
    expect(readRecallSlot("H₂")).toEqual({ coefficient: 1, formula: "H2" });
    expect(readRecallSlot("  ")).toBe("empty");
    for (const input of ["ZnCl2 + H2", "Zn&", "Zn(Cl2", "->"]) {
      expect(readRecallSlot(input), input).toBeNull();
    }
    expect(readRecallTerms("2 HCl + Zn")).toEqual([
      { coefficient: 2, formula: "HCl" },
      { coefficient: 1, formula: "Zn" },
    ]);
  });
});

describe("product slots", () => {
  it("accepts the products in any slot order, with or without coefficients", () => {
    for (const slots of [
      ["ZnCl2", "H2"],
      ["H2", "ZnCl2"],
      ["ZnCl₂", "1 H2"],
    ]) {
      const result = gradeProductSlots(slots, zincHcl.products, symbols);
      expect(result.status === "graded" && result.correct, slots.join("|")).toBe(true);
    }
    const nitric = gradeProductSlots(["H2O", "5 NO2", "H3PO4"], phosphorus.products, symbols);
    expect(nitric.status === "graded" && nitric.correct).toBe(true);
  });

  it("is case-sensitive and compares notation, not atom counts", () => {
    for (const slots of [
      ["zncl2", "H2"],
      ["Cl2Zn", "H2"],
      ["ZnCl2", "h2"],
    ]) {
      const result = gradeProductSlots(slots, zincHcl.products, symbols);
      expect(result.status === "graded" && result.correct, slots.join("|")).toBe(false);
    }
  });

  it("marks each slot and counts the missing products, ignoring blank slots", () => {
    const result = gradeProductSlots(["ZnCl2", "", "ZnCl2"], zincHcl.products, symbols);
    expect(result).toMatchObject({ status: "graded", correct: false, missingCount: 1 });
    if (result.status !== "graded") throw new Error("expected graded");
    expect(result.slots.map((slot) => slot?.verdict ?? null)).toEqual([
      "correct",
      null,
      "duplicate",
    ]);
    const wrong = gradeProductSlots(["H2O", "H2"], zincHcl.products, symbols);
    if (wrong.status !== "graded") throw new Error("expected graded");
    expect(wrong.slots.map((slot) => slot?.verdict)).toEqual(["wrong", "correct"]);
  });

  it("names the unreadable slots instead of grading", () => {
    expect(gradeProductSlots(["ZnCl2", "H2 & x"], zincHcl.products, symbols)).toEqual({
      status: "unreadable",
      unreadable: [1],
    });
  });
});

describe("route slots", () => {
  const hydrogen = [zincHcl, zincSulfuric, hydride];

  it("accepts any reviewed route, ignoring typed coefficients", () => {
    const result = gradeRouteSlots(["H2O", "CaH2"], ["H2", "Ca(OH)2"], hydrogen, symbols);
    expect(result).toMatchObject({ status: "graded", correct: true });
    expect(result.status === "graded" ? result.route : null).toBe(hydride);
    const sulfuric = gradeRouteSlots(["2 H2SO4", "Zn"], ["ZnSO4", "H2"], hydrogen, symbols);
    expect(sulfuric.status === "graded" ? sulfuric.route : null).toBe(zincSulfuric);
    const wrongNumbers = gradeRouteSlots(["Zn", "3 HCl"], ["ZnCl2", "H2"], hydrogen, symbols);
    expect(wrongNumbers).toMatchObject({ correct: true });
  });

  it("matches routes with a different number of terms through blank or added slots", () => {
    const three = equation("P + HNO3 -> H3PO4 + NO2 + H2O");
    const result = gradeRouteSlots(
      ["P", "HNO3"],
      ["H3PO4", "NO2", "H2O"],
      [zincHcl, three],
      symbols,
    );
    expect(result.status === "graded" ? result.route : null).toBe(three);
    const blanks = gradeRouteSlots(["Zn", "HCl", ""], ["H2", "ZnCl2", ""], hydrogen, symbols);
    expect(blanks).toMatchObject({ correct: true });
  });

  it("compares a wrong pathway with the closest reviewed route", () => {
    const result = gradeRouteSlots(["Zn", "H2O"], ["ZnO", "H2"], hydrogen, symbols);
    expect(result).toMatchObject({ status: "graded", correct: false, route: null });
    if (result.status !== "graded") throw new Error("expected graded");
    expect(result.reactants.slots.map((slot) => slot?.verdict)).toEqual(["correct", "wrong"]);
  });

  it("does not let a product stand in for a reactant", () => {
    const result = gradeRouteSlots(["ZnCl2", "H2"], ["Zn", "HCl"], hydrogen, symbols);
    expect(result).toMatchObject({ correct: false, route: null });
  });

  it("reports unreadable slots per side", () => {
    expect(gradeRouteSlots(["Zn", "H+Cl"], ["ZnCl2"], hydrogen, symbols)).toEqual({
      status: "unreadable",
      reactants: [1],
      products: [],
    });
  });
});
