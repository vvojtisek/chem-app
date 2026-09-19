import { describe, expect, it } from "vitest";

import { normalizeFormulaInput } from "./normalize-formula";

describe("normalizeFormulaInput", () => {
  it.each([
    [" H₂SO₄ ", "H2SO4"],
    ["CuSO4 ⋅ 5H2O", "CuSO4·5H2O"],
    ["Fe2(SO4)3", "Fe2(SO4)3"],
  ])("normalizes %s without guessing chemistry", (input, expected) => {
    expect(normalizeFormulaInput(input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ["", "empty_formula"],
    ["H₂SO₄!", "unsupported_character"],
    ["Na+ + Cl-", "unsupported_character"],
  ])("rejects unsupported input %s", (input, code) => {
    const result = normalizeFormulaInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(code);
    }
  });
});
