import { describe, expect, it } from "vitest";
import { deriveBalancing } from "./derive-balancing";

const symbols = new Set(["B", "F", "H", "O", "As", "S", "Fe", "Cl"]);
const s = (formula: string, charge = 0) => ({ formula, charge });

describe("exact balancing derivation", () => {
  it("derives BF3 ratios without accepting saved answer coefficients", () => {
    const result = deriveBalancing([s("BF3"), s("H2O")], [s("H[BF4]"), s("H3BO3")], symbols);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.coefficients).toEqual([4, 3, 3, 1]);
    expect(result.constraints.map((c) => c.label)).toEqual(["F", "B", "H", "O"]);
    expect(result.operations.length).toBeGreaterThan(0);
    expect(result.ratios).toEqual(["4", "3", "3", "1"]);
  });
  it("derives charge alongside atom constraints before H/O", () => {
    const result = deriveBalancing(
      [s("As2S3"), s("OH", -1)],
      [s("AsS3", -3), s("AsO3", -3), s("H2O")],
      symbols,
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.coefficients).toEqual([1, 6, 1, 1, 3]);
    expect(result.constraints.findIndex((c) => c.label === "Náboj")).toBeLessThan(
      result.constraints.findIndex((c) => c.label === "H"),
    );
  });
  it("uses exact fractions before integer normalization", () => {
    const result = deriveBalancing([s("Fe"), s("O2")], [s("Fe2O3")], symbols);
    if (!result.ok) throw new Error(result.reason);
    expect(result.ratios).toEqual(["2", "3/2", "1"]);
    expect(result.multiplier).toBe("2");
    expect(result.coefficients).toEqual([4, 3, 2]);
  });
  it("refuses to choose an arbitrary answer for an underdetermined peroxide skeleton", () => {
    expect(
      deriveBalancing([s("H2O2"), s("ClO", -1)], [s("O2"), s("Cl", -1), s("H2O")], symbols),
    ).toEqual({ ok: false, reason: "underdetermined" });
    const result = deriveBalancing(
      [s("H2O2"), s("ClO", -1)],
      [s("O2"), s("Cl", -1), s("H2O")],
      symbols,
      [{ label: "Peroxide oxidation", values: [1, 0, -1, 0, 0] }],
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.coefficients).toEqual([1, 1, 1, 1, 1]);
  });
  it("rejects invalid and nonpositive systems rather than filling coefficients", () => {
    expect(deriveBalancing([s("Xx")], [s("H2O")], symbols)).toEqual({
      ok: false,
      reason: "invalid-input",
    });
    expect(deriveBalancing([s("H2")], [s("H2"), s("O2")], symbols)).toEqual({
      ok: false,
      reason: "nonpositive",
    });
    expect(
      deriveBalancing([s("H2")], [s("H2")], symbols, [{ label: "Bad", values: [1.5] }]),
    ).toEqual({ ok: false, reason: "invalid-input" });
  });
});
