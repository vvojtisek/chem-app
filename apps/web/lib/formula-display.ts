const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

function toScript(digits: string, script: string): string {
  return [...digits].map((digit) => script[Number(digit)] ?? digit).join("");
}

/**
 * Renders a stored formula with subscripts and an optional ion charge as a superscript:
 * "SO4" with charge -2 -> "SO₄²⁻", "CuSO4·5H2O" -> "CuSO₄·5H₂O" (the hydrate coefficient
 * stays full size).
 */
export function formatFormula(formula: string, charge = 0): string {
  const [base = "", ...hydrates] = formula.split("·");
  const parts = [
    base.replaceAll(/\d+/gu, (digits) => toScript(digits, SUBSCRIPTS)),
    ...hydrates.map((part) => {
      const [, coefficient = "", rest = ""] = /^(\d*)(.*)$/u.exec(part) ?? [];
      return coefficient + rest.replaceAll(/\d+/gu, (digits) => toScript(digits, SUBSCRIPTS));
    }),
  ];
  return parts.join("·") + formatCharge(charge);
}

function formatCharge(charge: number): string {
  if (charge === 0) return "";
  const magnitude = Math.abs(charge);
  return `${magnitude === 1 ? "" : toScript(String(magnitude), SUPERSCRIPTS)}${charge > 0 ? "⁺" : "⁻"}`;
}

/** Plain text for assistive technology and tests: "SO4 2-", "NH4 +", "NaCl". */
export function plainFormula(formula: string, charge = 0): string {
  if (charge === 0) return formula;
  const magnitude = Math.abs(charge);
  return `${formula} ${magnitude === 1 ? "" : magnitude}${charge > 0 ? "+" : "-"}`;
}
