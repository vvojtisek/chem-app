import { listFormulaElements } from "@inorganic/chemistry";
import { curatedElements } from "@inorganic/content/runtime";

export type ChemicalTextPart =
  | { readonly kind: "text"; readonly text: string; readonly offset: number }
  | {
      readonly kind: "formula";
      readonly offset: number;
      readonly formula: string;
      readonly charge: number;
      readonly oxidation: string | null;
    };

const symbols = new Set(curatedElements.map((element) => element.symbol));
const romanMagnitudes: Readonly<Record<string, number>> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
};

/** Presentation only: recognize complete formulas, never infer an atom's ion charge from its oxidation state. */
export function chemicalTextParts(text: string): readonly ChemicalTextPart[] {
  const normalized = text.replaceAll("->", "→");
  const pattern =
    /(?:[A-Z][a-z]?\d*|\([A-Za-z0-9()]+\)\d*|\[[A-Za-z0-9()[\]]+\]\d*)+(?:·\d*[A-Za-z0-9()]+)?(?:\^\d*[+−-]|\([+−-][IVX]+\))?/gu;
  const parts: ChemicalTextPart[] = [];
  let cursor = 0;
  for (const match of normalized.matchAll(pattern)) {
    const token = match[0];
    const suffix = /(\^\d*[+−-]|\([+−-][IVX]+\))$/u.exec(token)?.[0] ?? "";
    const formula = suffix ? token.slice(0, -suffix.length) : token;
    // A bare symbol needs no typesetting. Leaving it plain also avoids reading Czech "V" as vanadium.
    if (!suffix && /^[A-Z][a-z]?$/u.test(formula)) continue;
    // Do not split prose words (including Czech words) into element symbols.
    const before = normalized[match.index - 1] ?? "";
    const after = normalized[match.index + token.length] ?? "";
    if (/\p{L}/u.test(before) || /\p{L}/u.test(after) || !listFormulaElements(formula, symbols))
      continue;
    let charge = 0;
    let oxidation: string | null = null;
    if (suffix.startsWith("^")) {
      charge = Number(suffix.slice(1, -1) || "1") * (suffix.endsWith("+") ? 1 : -1);
    } else if (suffix) {
      const value = suffix.slice(1, -1).replace("-", "−");
      const magnitude = romanMagnitudes[value.slice(1)];
      if (!magnitude) continue;
      // Legacy parenthesized polyatomic-group annotations represent the whole group's charge.
      if (formula.startsWith("(") || formula.startsWith("["))
        charge = magnitude * (value.startsWith("+") ? 1 : -1);
      else oxidation = value;
    }
    if (match.index > cursor)
      parts.push({ kind: "text", text: normalized.slice(cursor, match.index), offset: cursor });
    parts.push({ kind: "formula", formula, charge, oxidation, offset: match.index });
    cursor = match.index + token.length;
  }
  if (cursor < normalized.length)
    parts.push({ kind: "text", text: normalized.slice(cursor), offset: cursor });
  return parts;
}
