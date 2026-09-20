import { describe, expect, it } from "vitest";

import { normalizeAnswer, normalizeAnswerWithoutDiacritics } from "./normalize-answer";

describe("normalizeAnswer", () => {
  it("normalizes Czech answer casing, Unicode composition, and spacing", () => {
    expect(normalizeAnswer("  VODI\u0301K  ")).toBe("vodík");
  });

  it("preserves meaningful Czech diacritics", () => {
    expect(normalizeAnswer("síra")).not.toBe(normalizeAnswer("sira"));
  });

  it("provides a separate opt-in comparison for omitted diacritics", () => {
    expect(normalizeAnswerWithoutDiacritics("Vodík")).toBe("vodik");
  });
});
