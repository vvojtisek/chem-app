export function normalizeAnswer(value: string): string {
  return value.normalize("NFC").trim().replaceAll(/\s+/gu, " ").toLocaleLowerCase("cs-CZ");
}

export function normalizeAnswerWithoutDiacritics(value: string): string {
  return normalizeAnswer(value).normalize("NFD").replaceAll(/\p{M}/gu, "");
}
