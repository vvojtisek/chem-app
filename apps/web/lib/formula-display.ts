export type FormulaSegmentKind = "text" | "sub" | "sup";

export interface FormulaSegment {
  readonly kind: FormulaSegmentKind;
  readonly text: string;
}

/**
 * Splits a stored formula into typeset segments: atom counts become subscripts and the ion
 * charge a superscript with a true minus sign. "SO4" with charge -2 -> SO, ₄, ²⁻ as
 * text/sub/sup; in "CuSO4·5H2O" the hydrate coefficient 5 stays full size.
 */
export function formulaSegments(formula: string, charge = 0): FormulaSegment[] {
  const segments: FormulaSegment[] = [];
  const push = (kind: FormulaSegmentKind, text: string) => {
    const previous = segments.at(-1);
    if (previous?.kind === kind)
      segments[segments.length - 1] = { kind, text: previous.text + text };
    else segments.push({ kind, text });
  };
  for (const [index, part] of formula.split("·").entries()) {
    if (index > 0) push("text", "·");
    const [, coefficient = "", rest = ""] = /^(\d*)(.*)$/u.exec(part) ?? [];
    if (coefficient) push("text", coefficient);
    for (const [, digits, other] of rest.matchAll(/(\d+)|(\D+)/gu)) {
      if (digits) push("sub", digits);
      else if (other) push("text", other);
    }
  }
  if (charge !== 0) {
    const magnitude = Math.abs(charge);
    push("sup", `${magnitude === 1 ? "" : magnitude}${charge > 0 ? "+" : "−"}`);
  }
  return segments;
}

/** Plain text for assistive technology and tests: "SO4 2-", "NH4 +", "NaCl". */
export function plainFormula(formula: string, charge = 0): string {
  if (charge === 0) return formula;
  const magnitude = Math.abs(charge);
  return `${formula} ${magnitude === 1 ? "" : magnitude}${charge > 0 ? "+" : "-"}`;
}
