import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_ROUND_LENGTH,
  loadRoundLength,
  plannedRoundSize,
  saveRoundLength,
} from "./round-length";

afterEach(() => window.localStorage.clear());

describe("round length", () => {
  it("defaults to 20 questions and remembers the choice per exercise", () => {
    expect(loadRoundLength("nomenclature")).toBe(DEFAULT_ROUND_LENGTH);
    expect(loadRoundLength("periodic-name", null)).toBeNull();
    saveRoundLength("nomenclature", null);
    saveRoundLength("periodic-name", 10);
    expect(loadRoundLength("nomenclature")).toBeNull();
    expect(loadRoundLength("periodic-name")).toBe(10);
  });

  it("ignores corrupt stored values", () => {
    window.localStorage.setItem("inorganic.roundLength.nomenclature", '{"length":7}');
    expect(loadRoundLength("nomenclature")).toBe(DEFAULT_ROUND_LENGTH);
  });

  it("never plans more questions than are available", () => {
    expect(plannedRoundSize(468, 20)).toBe(20);
    expect(plannedRoundSize(6, 20)).toBe(6);
    expect(plannedRoundSize(468, null)).toBe(468);
  });
});
