export interface EquationTerm {
  readonly coefficient: number;
  readonly formula: string;
}

export interface ParsedEquation {
  readonly reactants: readonly EquationTerm[];
  readonly products: readonly EquationTerm[];
}

export interface EquationFormula {
  readonly canonical: string;
  readonly atomCounts: Readonly<Record<string, number>>;
}

const SUBSCRIPT_DIGITS: Readonly<Record<string, string>> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
};

function normalizeFormula(formula: string): string {
  return formula
    .normalize("NFC")
    .replace(/[₀-₉]/gu, (digit) => SUBSCRIPT_DIGITS[digit] ?? digit)
    .replace(/\s+/gu, "");
}

/** Parses element formulas with nested round or square groups for equation records. */
export function parseEquationFormula(
  input: string,
  allowedSymbols: ReadonlySet<string>,
): EquationFormula | null {
  const source = normalizeFormula(input);
  if (!source || source.length > 256 || !/^[A-Za-z0-9()[\]]+$/u.test(source)) return null;
  let position = 0;

  function parseCount(): number | null {
    const start = position;
    while (position < source.length && /[0-9]/u.test(source[position] ?? "")) position += 1;
    if (position === start) return 1;
    const text = source.slice(start, position);
    const value = Number(text);
    return text.startsWith("0") || !Number.isSafeInteger(value) || value > 999 ? null : value;
  }

  function parseSequence(closing: ")" | "]" | null): Record<string, number> | null {
    const counts: Record<string, number> = {};
    let terms = 0;
    while (position < source.length && source[position] !== closing) {
      if (++terms > 128) return null;
      const character = source[position] ?? "";
      if (character === "(" || character === "[") {
        position += 1;
        const expected = character === "(" ? ")" : "]";
        const nested = parseSequence(expected);
        if (!nested || source[position] !== expected || Object.keys(nested).length === 0)
          return null;
        position += 1;
        const multiplier = parseCount();
        if (multiplier === null) return null;
        for (const [symbol, quantity] of Object.entries(nested)) {
          const next = (counts[symbol] ?? 0) + quantity * multiplier;
          if (!Number.isSafeInteger(next)) return null;
          counts[symbol] = next;
        }
        continue;
      }
      if (!/^[A-Z]$/u.test(character)) return null;
      let symbol = character;
      position += 1;
      if (/^[a-z]$/u.test(source[position] ?? "")) {
        symbol += source[position];
        position += 1;
      }
      if (!allowedSymbols.has(symbol)) return null;
      const multiplier = parseCount();
      if (multiplier === null) return null;
      const next = (counts[symbol] ?? 0) + multiplier;
      if (!Number.isSafeInteger(next)) return null;
      counts[symbol] = next;
    }
    return counts;
  }

  const atomCounts = parseSequence(null);
  if (!atomCounts || position !== source.length || Object.keys(atomCounts).length === 0)
    return null;
  return { canonical: source, atomCounts };
}

/** Parses a learner-entered equation without inferring or repairing chemical notation. */
export function parseEquationAnswer(input: string): ParsedEquation | null {
  const normalized = input
    .normalize("NFC")
    .replace(/[₀-₉]/gu, (digit) => SUBSCRIPT_DIGITS[digit] ?? digit)
    .replace(/[→⟶]/gu, "->")
    .trim();
  const arrow = normalized.indexOf("->");
  if (arrow < 0 || normalized.indexOf("->", arrow + 2) >= 0) return null;
  const reactants = parseEquationSide(normalized.slice(0, arrow));
  const products = parseEquationSide(normalized.slice(arrow + 2));
  return reactants && products ? { reactants, products } : null;
}

function parseEquationSide(input: string): readonly EquationTerm[] | null {
  const pieces: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === "(" || character === "[") depth += 1;
    if (character === ")" || character === "]") depth -= 1;
    if (depth < 0) return null;
    if (character === "+" && depth === 0) {
      pieces.push(input.slice(start, index));
      start = index + 1;
    }
  }
  if (depth !== 0) return null;
  pieces.push(input.slice(start));
  if (pieces.length === 0) return null;

  const terms: EquationTerm[] = [];
  for (const piece of pieces) {
    const match = /^\s*(\d*)\s*([A-Za-z0-9()[\]]+)\s*$/u.exec(piece);
    if (!match) return null;
    const coefficient = match[1] ? Number(match[1]) : 1;
    if (!Number.isSafeInteger(coefficient) || coefficient < 1 || coefficient > 999) return null;
    terms.push({ coefficient, formula: normalizeFormula(match[2] ?? "") });
  }
  return terms;
}

/** Compares complete equations while allowing either side's terms to be reordered. */
export function matchesEquation(input: string, accepted: ParsedEquation): boolean {
  const parsed = parseEquationAnswer(input);
  if (!parsed) return false;
  return (
    sameSide(parsed.reactants, accepted.reactants) && sameSide(parsed.products, accepted.products)
  );
}

function sameSide(left: readonly EquationTerm[], right: readonly EquationTerm[]): boolean {
  if (left.length !== right.length) return false;
  const signature = (terms: readonly EquationTerm[]) =>
    terms
      .map(({ coefficient, formula }) => `${coefficient}:${formula}`)
      .sort()
      .join("|");
  return signature(left) === signature(right);
}

/** Checks elemental conservation for an authored equation. */
export function isBalancedEquation(
  reactants: readonly EquationTerm[],
  products: readonly EquationTerm[],
  allowedSymbols: ReadonlySet<string>,
): boolean {
  const balance = new Map<string, number>();
  for (const [terms, direction] of [
    [reactants, 1],
    [products, -1],
  ] as const) {
    if (terms.length === 0) return false;
    for (const { coefficient, formula } of terms) {
      if (!Number.isSafeInteger(coefficient) || coefficient < 1 || coefficient > 999) return false;
      const parsed = parseEquationFormula(formula, allowedSymbols);
      if (!parsed || parsed.canonical !== normalizeFormula(formula)) return false;
      for (const [symbol, quantity] of Object.entries(parsed.atomCounts)) {
        balance.set(symbol, (balance.get(symbol) ?? 0) + direction * coefficient * quantity);
      }
    }
  }
  return [...balance.values()].every((quantity) => quantity === 0);
}

/** True when every stored coefficient belongs to the lowest positive-integer ratio. */
export function hasReducedEquationCoefficients(
  reactants: readonly EquationTerm[],
  products: readonly EquationTerm[],
): boolean {
  const coefficients = [...reactants, ...products].map((term) => term.coefficient);
  if (coefficients.length === 0) return false;
  const gcd = (left: number, right: number): number =>
    right === 0 ? left : gcd(right, left % right);
  return coefficients.reduce((divisor, coefficient) => gcd(divisor, coefficient)) === 1;
}
