import { describe, expect, it } from "vitest";
import { parseFormula } from "./parse-formula";

const symbols = new Set(["Ag", "Al", "C", "Ca", "Cl", "Co", "Cu", "Fe", "H", "N", "O", "S"]);

describe("parseFormula", () => {
  it.each([
    ["AgCl", "AgCl", { Ag: 1, Cl: 1 }],
    ["Al2(SO4)3", "Al2(SO4)3", { Al: 2, S: 3, O: 12 }],
    ["(NH4)2SO4", "(NH4)2SO4", { N: 2, H: 8, S: 1, O: 4 }],
    ["CuSO₄.5H₂O", "CuSO4·5H2O", { Cu: 1, S: 1, O: 9, H: 10 }],
    ["CuSO4 ⋅ 5H2O", "CuSO4·5H2O", { Cu: 1, S: 1, O: 9, H: 10 }],
    ["Co", "Co", { Co: 1 }],
  ])("parses %s completely", (input, canonical, atomCounts) => {
    expect(parseFormula(input, symbols)).toEqual({ ok: true, canonical, atomCounts });
  });

  it.each([
    ["", "empty_formula"],
    ["H[AgCl]", "unsupported_character"],
    ["C o", "invalid_spacing"],
    ["co", "invalid_syntax"],
    ["Xx2", "invalid_symbol"],
    ["Ca(OH2", "unmatched_group"],
    ["Ca()2", "empty_group"],
    ["Ca((OH))2", "nested_group"],
    ["H0", "invalid_count"],
    ["H01", "invalid_count"],
    ["CuSO4.4H2O2", "invalid_hydrate"],
    ["CuSO4.", "invalid_hydrate"],
    ["Fe1.5O", "invalid_hydrate"],
    ["2H2O", "invalid_syntax"],
  ])("rejects %s with %s", (input, code) => {
    const result = parseFormula(input, symbols);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });
});
