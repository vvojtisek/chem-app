const SYMBOL = /[A-Z][a-z]?/gu;
const NOTATION = /^[A-Za-z0-9()[\]·.]+$/u;

/**
 * Lists the distinct element symbols in a stored formula, in order of first appearance.
 * Accepts the notations used in curriculum records (parentheses, square brackets for
 * coordination entities, and "·" for hydrates) but not a charge, which is stored separately.
 * Returns null for any other character or an unknown symbol.
 */
export function listFormulaElements(
  formula: string,
  allowedSymbols: ReadonlySet<string>,
): readonly string[] | null {
  if (!NOTATION.test(formula) || /^[a-z0-9]/u.test(formula)) return null;
  const symbols = formula.match(SYMBOL) ?? [];
  if (symbols.join("").length !== formula.replaceAll(/[0-9()[\]·.]/gu, "").length) return null;
  if (!symbols.every((symbol) => allowedSymbols.has(symbol))) return null;
  return [...new Set(symbols)];
}
