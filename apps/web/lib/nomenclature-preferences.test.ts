import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadNomenclatureDirection,
  loadNomenclatureFilters,
  NOMENCLATURE_DIRECTION_KEY,
  NOMENCLATURE_FILTERS_KEY,
  saveNomenclatureDirection,
  saveNomenclatureFilters,
} from "./nomenclature-preferences";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("nomenclature preferences", () => {
  it("restores the last filters and direction", () => {
    const filters = {
      categories: ["oxide" as const, "binary-salt" as const],
      families: ["binary-salt:chlorid"],
      elementCount: "2" as const,
    };
    saveNomenclatureFilters(filters);
    saveNomenclatureDirection("name-to-formula");

    expect(loadNomenclatureFilters()).toEqual(filters);
    expect(loadNomenclatureDirection()).toBe("name-to-formula");
    expect(JSON.parse(window.localStorage.getItem(NOMENCLATURE_FILTERS_KEY) ?? "null")).toEqual({
      schemaVersion: 1,
      filters,
    });
  });

  it.each([
    ["corrupt JSON", "{"],
    [
      "an unknown category",
      JSON.stringify({
        schemaVersion: 1,
        filters: { categories: ["salt"], families: [], elementCount: "all" },
      }),
    ],
    [
      "an unknown element count",
      JSON.stringify({
        schemaVersion: 1,
        filters: { categories: [], families: [], elementCount: "5" },
      }),
    ],
    [
      "an unknown version",
      JSON.stringify({
        schemaVersion: 2,
        filters: { categories: [], families: [], elementCount: "all" },
      }),
    ],
  ])("ignores stored filters with %s", (_, value) => {
    window.localStorage.setItem(NOMENCLATURE_FILTERS_KEY, value);
    expect(loadNomenclatureFilters()).toBeNull();
  });

  it("ignores an unknown direction and blocked storage", () => {
    window.localStorage.setItem(
      NOMENCLATURE_DIRECTION_KEY,
      JSON.stringify({ schemaVersion: 1, direction: "symbol-to-name" }),
    );
    expect(loadNomenclatureDirection()).toBeNull();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(loadNomenclatureFilters()).toBeNull();
  });
});
