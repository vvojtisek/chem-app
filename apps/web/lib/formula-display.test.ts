import { describe, expect, it } from "vitest";

import { formatFormula, plainFormula } from "./formula-display";

describe("formatFormula", () => {
  it.each([
    ["Al2O3", 0, "Al₂O₃"],
    ["Ca3(PO4)2", 0, "Ca₃(PO₄)₂"],
    ["CuSO4·5H2O", 0, "CuSO₄·5H₂O"],
    ["CaSO4·H2O", 0, "CaSO₄·H₂O"],
    ["SO4", -2, "SO₄²⁻"],
    ["NH4", 1, "NH₄⁺"],
    ["Fe", 3, "Fe³⁺"],
    ["[AlF6]", -3, "[AlF₆]³⁻"],
    ["N3", -1, "N₃⁻"],
    ["SiO4", -4, "SiO₄⁴⁻"],
  ] as const)("renders %s with charge %i as %s", (formula, charge, expected) => {
    expect(formatFormula(formula, charge)).toBe(expected);
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
