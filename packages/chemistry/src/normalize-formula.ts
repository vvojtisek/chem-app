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

const ALLOWED_CHARACTERS = /^[A-Za-z0-9₀-₉().·⋅\s]+$/u;

export interface FormulaNormalizationError {
  readonly code: "empty_formula" | "unsupported_character" | "invalid_spacing";
  readonly message: string;
}

export type FormulaNormalizationResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: FormulaNormalizationError };

/**
 * Performs lexical normalization only. Structural and chemical validation belong to the parser.
 */
export function normalizeFormulaInput(input: string): FormulaNormalizationResult {
  const unicodeNormalized = input.normalize("NFC").trim();

  if (unicodeNormalized.length === 0) {
    return {
      ok: false,
      error: { code: "empty_formula", message: "Formula must not be empty." },
    };
  }

  if (!ALLOWED_CHARACTERS.test(unicodeNormalized)) {
    return {
      ok: false,
      error: {
        code: "unsupported_character",
        message: "Formula contains a character outside the supported grammar.",
      },
    };
  }

  for (const whitespace of unicodeNormalized.matchAll(/\s+/gu)) {
    const position = whitespace.index;
    const before = unicodeNormalized[position - 1];
    const after = unicodeNormalized[position + whitespace[0].length];
    if (!before || !after || !/[().·⋅]/u.test(before + after)) {
      return {
        ok: false,
        error: {
          code: "invalid_spacing",
          message: "Whitespace may only surround a group or hydrate separator.",
        },
      };
    }
  }

  const value = Array.from(unicodeNormalized)
    .map((character) => SUBSCRIPT_DIGITS[character] ?? character)
    .join("")
    .replaceAll("⋅", "·")
    .replaceAll(/\s+/gu, "");

  return { ok: true, value };
}
