import { normalizeFormulaInput } from "./normalize-formula";

export type FormulaParseErrorCode =
  | "empty_formula"
  | "unsupported_character"
  | "invalid_spacing"
  | "invalid_symbol"
  | "invalid_count"
  | "unmatched_group"
  | "nested_group"
  | "empty_group"
  | "invalid_hydrate"
  | "invalid_syntax"
  | "formula_too_long"
  | "too_many_terms"
  | "count_overflow";

export interface FormulaParseError {
  readonly code: FormulaParseErrorCode;
  readonly position: number;
}

export type FormulaParseResult =
  | {
      readonly ok: true;
      readonly canonical: string;
      readonly atomCounts: Readonly<Record<string, number>>;
    }
  | { readonly ok: false; readonly error: FormulaParseError };

const MAX_LENGTH = 256;
const MAX_TERMS = 128;
const MAX_COUNT = 999;

function failure(code: FormulaParseErrorCode, position: number): FormulaParseResult {
  return { ok: false, error: { code, position } };
}

function isUpper(character: string | undefined): boolean {
  return character !== undefined && /^[A-Z]$/u.test(character);
}

function isLower(character: string | undefined): boolean {
  return character !== undefined && /^[a-z]$/u.test(character);
}

function isDigit(character: string | undefined): boolean {
  return character !== undefined && /^[0-9]$/u.test(character);
}

/**
 * Parses the documented neutral-compound grammar. Chemical identity is not
 * inferred from atom counts; callers compare canonical notation or aliases.
 */
export function parseFormula(
  input: string,
  allowedSymbols: ReadonlySet<string>,
): FormulaParseResult {
  if (input.length > MAX_LENGTH) return failure("formula_too_long", MAX_LENGTH);

  const normalized = normalizeFormulaInput(input);
  if (!normalized.ok) return failure(normalized.error.code, 0);
  const source = normalized.value;
  if (source.length > MAX_LENGTH) return failure("formula_too_long", MAX_LENGTH);

  let position = 0;
  let terms = 0;
  const atomCounts: Record<string, number> = {};

  function count(): { ok: true; value: number; text: string } | { ok: false } {
    const start = position;
    while (isDigit(source[position])) position += 1;
    if (start === position) return { ok: true, value: 1, text: "" };
    const text = source.slice(start, position);
    const value = Number(text);
    if (text.startsWith("0") || !Number.isSafeInteger(value) || value > MAX_COUNT) {
      return { ok: false };
    }
    return { ok: true, value, text: value === 1 ? "" : text };
  }

  function addCounts(symbol: string, amount: number): boolean {
    const next = (atomCounts[symbol] ?? 0) + amount;
    if (!Number.isSafeInteger(next)) return false;
    atomCounts[symbol] = next;
    return true;
  }

  function sequence(
    inGroup: boolean,
  ):
    | { ok: true; text: string; counts: Readonly<Record<string, number>> }
    | { ok: false; error: FormulaParseError } {
    const parts: string[] = [];
    const localCounts: Record<string, number> = {};
    while (
      position < source.length &&
      source[position] !== ")" &&
      source[position] !== "·" &&
      source[position] !== "."
    ) {
      const start = position;
      if (++terms > MAX_TERMS)
        return { ok: false, error: { code: "too_many_terms", position: start } };
      if (source[position] === "(") {
        if (inGroup) return { ok: false, error: { code: "nested_group", position } };
        position += 1;
        const nested = sequence(true);
        if (!nested.ok) return nested;
        if (source[position] !== ")")
          return { ok: false, error: { code: "unmatched_group", position } };
        position += 1;
        if (nested.text.length === 0)
          return { ok: false, error: { code: "empty_group", position: start } };
        const multiplier = count();
        if (!multiplier.ok) return { ok: false, error: { code: "invalid_count", position: start } };
        parts.push(`(${nested.text})${multiplier.text}`);
        for (const [symbol, quantity] of Object.entries(nested.counts)) {
          const next = (localCounts[symbol] ?? 0) + quantity * multiplier.value;
          if (!Number.isSafeInteger(next))
            return { ok: false, error: { code: "count_overflow", position: start } };
          localCounts[symbol] = next;
        }
        continue;
      }
      if (!isUpper(source[position]))
        return { ok: false, error: { code: "invalid_syntax", position } };
      let symbol = source[position] ?? "";
      position += 1;
      if (isLower(source[position])) {
        symbol += source[position];
        position += 1;
      }
      if (!allowedSymbols.has(symbol))
        return { ok: false, error: { code: "invalid_symbol", position: start } };
      const multiplier = count();
      if (!multiplier.ok) return { ok: false, error: { code: "invalid_count", position: start } };
      parts.push(symbol + multiplier.text);
      const next = (localCounts[symbol] ?? 0) + multiplier.value;
      if (!Number.isSafeInteger(next))
        return { ok: false, error: { code: "count_overflow", position: start } };
      localCounts[symbol] = next;
    }
    return { ok: true, text: parts.join(""), counts: localCounts };
  }

  const base = sequence(false);
  if (!base.ok) return base;
  if (base.text.length === 0) return failure("invalid_syntax", position);
  for (const [symbol, amount] of Object.entries(base.counts)) {
    if (!addCounts(symbol, amount)) return failure("count_overflow", position);
  }

  let canonical = base.text;
  if (source[position] === ")" || source.includes("(", position)) {
    return failure("unmatched_group", position);
  }
  if (source[position] === "." || source[position] === "·") {
    const dotPosition = position;
    position += 1;
    const hydrateCount = count();
    if (!hydrateCount.ok || source.slice(position) !== "H2O") {
      return failure("invalid_hydrate", dotPosition);
    }
    if (!addCounts("H", 2 * hydrateCount.value) || !addCounts("O", hydrateCount.value)) {
      return failure("count_overflow", dotPosition);
    }
    canonical += `·${hydrateCount.value === 1 ? "" : String(hydrateCount.value)}H2O`;
    position = source.length;
  }
  if (position !== source.length) return failure("invalid_syntax", position);
  return { ok: true, canonical, atomCounts };
}
