export function normalizeAnswer(value: string): string {
  return value.normalize("NFC").trim().replaceAll(/\s+/gu, " ").toLocaleLowerCase("cs-CZ");
}
