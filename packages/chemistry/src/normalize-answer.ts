export function normalizeAnswer(value: string): string {
  return value.normalize("NFC").trim().replaceAll(/\s+/gu, " ").toLocaleLowerCase("cs-CZ");
}

export function normalizeAnswerWithoutDiacritics(value: string): string {
  return normalizeAnswer(value).normalize("NFD").replaceAll(/\p{M}/gu, "");
}

const DASHES = /[-‐‑‒–—―−]/gu;

/**
 * Lenient comparison form for typed Czech names: no diacritics, lower case, single spaces,
 * every hyphen or dash variant unified to "-", and no spaces around it
 * ("chlorid - chlornan" and "chlorid–chlornan" both become "chlorid-chlornan").
 */
export function normalizeLenientAnswer(value: string): string {
  return normalizeAnswerWithoutDiacritics(value)
    .replaceAll(DASHES, "-")
    .replaceAll(/\s*-\s*/gu, "-")
    .trim();
}

/** The lenient form with every space removed, for answers that differ only in word breaks. */
export function compactLenientAnswer(value: string): string {
  return normalizeLenientAnswer(value).replaceAll(" ", "");
}
