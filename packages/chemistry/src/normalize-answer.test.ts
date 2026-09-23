import { describe, expect, it } from "vitest";

import {
  compactLenientAnswer,
  normalizeAnswer,
  normalizeAnswerWithoutDiacritics,
  normalizeLenientAnswer,
} from "./normalize-answer";

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

describe("normalizeLenientAnswer", () => {
  it("removes diacritics, lowercases, and collapses spacing", () => {
    expect(normalizeLenientAnswer("  Hexahydrát   CHLORIDU hořečnatého ")).toBe(
      "hexahydrat chloridu horecnateho",
    );
  });

  it.each([
    "chlorid - chlornan vápenatý",
    "chlorid–chlornan vápenatý",
    "chlorid — chlornan vápenatý",
    "chlorid-chlornan vápenatý",
  ])("unifies dash variants and the spaces around them in %j", (input) => {
    expect(normalizeLenientAnswer(input)).toBe("chlorid-chlornan vapenaty");
  });

  it("offers a compact form without any spaces", () => {
    expect(compactLenientAnswer("hexahydrát chloridu hořečnatého")).toBe(
      "hexahydratchloriduhorecnateho",
    );
    expect(compactLenientAnswer("tetrakarbonyl nikl")).toBe(
      compactLenientAnswer("tetrakarbonylnikl"),
    );
  });
});
