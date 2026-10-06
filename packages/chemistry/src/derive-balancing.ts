import { parseEquationFormula } from "./parse-equation";

export interface BalancingSpecies {
  readonly formula: string;
  readonly charge: number;
}

export interface BalancingConstraint {
  readonly label: string;
  readonly values: readonly number[];
}

export interface BalancingOperation {
  readonly label: string;
  readonly before: string;
  readonly arithmetic: string;
  readonly after: string;
}

export type BalancingDerivation =
  | { readonly ok: false; readonly reason: "invalid-input" | "underdetermined" | "nonpositive" }
  | {
      readonly ok: true;
      readonly constraints: readonly BalancingConstraint[];
      readonly operations: readonly BalancingOperation[];
      readonly coefficients: readonly number[];
      readonly ratios: readonly string[];
      readonly multiplier: string;
      readonly freeVariable: number;
    };

interface Fraction {
  readonly n: bigint;
  readonly d: bigint;
}
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const fraction = (n: bigint, d = 1n): Fraction => {
  if (d === 0n) throw new Error("Zero denominator");
  const divisor = gcd(n, d);
  return { n: (d < 0n ? -n : n) / divisor, d: (d < 0n ? -d : d) / divisor };
};
const subtract = (a: Fraction, b: Fraction) => fraction(a.n * b.d - b.n * a.d, a.d * b.d);
const multiply = (a: Fraction, b: Fraction) => fraction(a.n * b.n, a.d * b.d);
const divide = (a: Fraction, b: Fraction) => fraction(a.n * b.d, a.d * b.n);
const display = (a: Fraction) => (a.d === 1n ? String(a.n) : `${a.n}/${a.d}`);

/** Human-readable exact conservation equation; c1, c2, ... follow species order. */
export function balancingConstraintEquation(values: readonly number[]): string {
  return equation(values.map((value) => fraction(BigInt(value))));
}

function equation(values: readonly Fraction[]): string {
  const side = (positive: boolean) =>
    values
      .flatMap((value, index) => {
        if (value.n === 0n || value.n > 0n !== positive) return [];
        return [`${display(fraction(value.n < 0n ? -value.n : value.n, value.d))} × c${index + 1}`];
      })
      .join(" + ") || "0";
  return `${side(true)} = ${side(false)}`;
}

/** Derives ratios from formulas and charge only, never from saved answer coefficients.
 * An underdetermined skeleton needs an explicit, independently authored extra constraint.
 * Exact bigint fractions avoid floating-point stoichiometry. */
export function deriveBalancing(
  reactants: readonly BalancingSpecies[],
  products: readonly BalancingSpecies[],
  allowedSymbols: ReadonlySet<string>,
  extraConstraints: readonly BalancingConstraint[] = [],
): BalancingDerivation {
  const species = [...reactants, ...products];
  if (!reactants.length || !products.length || species.some((s) => !Number.isSafeInteger(s.charge)))
    return { ok: false, reason: "invalid-input" };
  const parsed = species.map((s) => parseEquationFormula(s.formula, allowedSymbols));
  if (parsed.some((s) => !s)) return { ok: false, reason: "invalid-input" };
  const elements = [...new Set(parsed.flatMap((s) => Object.keys(s?.atomCounts ?? {})))];
  const direction = (i: number) => (i < reactants.length ? 1 : -1);
  const constraints: BalancingConstraint[] = elements.map((element) => ({
    label: element,
    values: parsed.map((s, i) => (s?.atomCounts[element] ?? 0) * direction(i)),
  }));
  const priority = (row: BalancingConstraint) => {
    if (row.label === "H" || row.label === "O") return 3;
    return row.values.filter((v) => v > 0).length === 1 &&
      row.values.filter((v) => v < 0).length === 1
      ? 0
      : 1;
  };
  constraints.sort((a, b) => priority(a) - priority(b));
  const charge = species.map((s, i) => s.charge * direction(i));
  if (charge.some((v) => v !== 0)) {
    const firstSolvent = constraints.findIndex((r) => priority(r) === 3);
    constraints.splice(firstSolvent < 0 ? constraints.length : firstSolvent, 0, {
      label: "Náboj",
      values: charge,
    });
  }
  for (const row of extraConstraints) {
    if (row.values.length !== species.length || row.values.some((v) => !Number.isSafeInteger(v)))
      return { ok: false, reason: "invalid-input" };
    constraints.push(row);
  }
  const rows = constraints.map((c) => c.values.map((v) => fraction(BigInt(v))));
  const labels = constraints.map((c) => c.label);
  const operations: BalancingOperation[] = [];
  const pivots: number[] = [];
  let rank = 0;
  for (let column = 0; column < species.length; column++) {
    const pivot = rows.findIndex((r, i) => i >= rank && r[column]?.n !== 0n);
    if (pivot < 0) continue;
    const selected = rows[pivot];
    const current = rows[rank];
    const selectedLabel = labels[pivot];
    const currentLabel = labels[rank];
    if (!selected || !current || !selectedLabel || !currentLabel)
      return { ok: false, reason: "invalid-input" };
    rows[rank] = selected;
    rows[pivot] = current;
    labels[rank] = selectedLabel;
    labels[pivot] = currentLabel;
    const divisor = selected[column];
    if (!divisor) return { ok: false, reason: "invalid-input" };
    const before = equation(selected);
    const normalized = selected.map((v) => divide(v, divisor));
    rows[rank] = normalized;
    if (divisor.n !== divisor.d)
      operations.push({
        label: selectedLabel,
        before,
        arithmetic: `Obě strany dělíme ${display(divisor)}.`,
        after: equation(normalized),
      });
    for (let index = 0; index < rows.length; index++) {
      if (index === rank) continue;
      const row = rows[index];
      const factor = row?.[column];
      if (!row || !factor || factor.n === 0n) continue;
      const result = row.map((v, i) =>
        subtract(v, multiply(factor, normalized[i] ?? fraction(0n))),
      );
      operations.push({
        label: labels[index] ?? "Bilance",
        before: equation(row),
        arithmetic: `Odečteme (${display(factor)}) × [${equation(normalized)}], abychom odstranili c${column + 1}.`,
        after: equation(result),
      });
      rows[index] = result;
    }
    pivots.push(column);
    rank++;
  }
  if (species.length - rank !== 1) return { ok: false, reason: "underdetermined" };
  const freeVariable = species.findIndex((_, i) => !pivots.includes(i));
  const solution = species.map(() => fraction(0n));
  solution[freeVariable] = fraction(1n);
  for (let row = 0; row < rank; row++) {
    const column = pivots[row];
    const value = rows[row]?.[freeVariable];
    if (column === undefined || !value) return { ok: false, reason: "invalid-input" };
    solution[column] = fraction(-value.n, value.d);
  }
  if (solution.some((v) => v.n <= 0n)) return { ok: false, reason: "nonpositive" };
  const multiplier = solution.reduce((common, v) => (common / gcd(common, v.d)) * v.d, 1n);
  const integers = solution.map((v) => v.n * (multiplier / v.d));
  const divisor = integers.reduce(gcd);
  const coefficients = integers.map((v) => Number(v / divisor));
  if (coefficients.some((v) => !Number.isSafeInteger(v) || v < 1 || v > 999))
    return { ok: false, reason: "invalid-input" };
  return {
    ok: true,
    constraints,
    operations,
    coefficients,
    ratios: solution.map(display),
    multiplier: String(multiplier / divisor),
    freeVariable,
  };
}
