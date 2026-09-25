import { describe, expect, it } from "vitest";

import { type FormulaSegment, formulaSegments, plainFormula } from "./formula-display";

/** Compact notation for the expectations: _x_ is a subscript, ^x^ a superscript. */
function notation(segments: readonly FormulaSegment[]): string {
  return segments
    .map(({ kind, text }) => (kind === "sub" ? `_${text}_` : kind === "sup" ? `^${text}^` : text))
    .join("");
}

describe("formulaSegments", () => {
  it.each([
    ["NaCl", 0, "NaCl"],
    ["Al2O3", 0, "Al_2_O_3_"],
    ["Ca3(PO4)2", 0, "Ca_3_(PO_4_)_2_"],
    ["[Cu(NH3)4]SO4", 0, "[Cu(NH_3_)_4_]SO_4_"],
    ["CuSO4·5H2O", 0, "CuSO_4_·5H_2_O"],
    ["CaSO4·H2O", 0, "CaSO_4_·H_2_O"],
    ["SO4", -2, "SO_4_^2−^"],
    ["NH4", 1, "NH_4_^+^"],
    ["Fe", 3, "Fe^3+^"],
    ["[AlF6]", -3, "[AlF_6_]^3−^"],
    ["N3", -1, "N_3_^−^"],
    ["SiO4", -4, "SiO_4_^4−^"],
  ] as const)("typesets %s with charge %i as %s", (formula, charge, expected) => {
    expect(notation(formulaSegments(formula, charge))).toBe(expected);
  });

  it("uses a true minus sign for anions", () => {
    expect(formulaSegments("Cl", -1).at(-1)).toEqual({ kind: "sup", text: "−" });
  });
});

describe("plainFormula", () => {
  it.each([
    ["NaCl", 0, "NaCl"],
    ["SO4", -2, "SO4 2-"],
    ["NH4", 1, "NH4 +"],
    ["N3", -1, "N3 -"],
  ] as const)("describes %s with charge %i as %s", (formula, charge, expected) => {
    expect(plainFormula(formula, charge)).toBe(expected);
  });
});
