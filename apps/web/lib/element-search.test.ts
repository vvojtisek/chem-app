import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { describe, expect, it } from "vitest";

import { EMPTY_ELEMENT_FILTERS, filterElements } from "./element-search";

function element(
  atomicNumber: number,
  symbol: string,
  nameCs: string,
  nameLat: string,
  period: number,
  group: number | null,
): ElementFlashcardData {
  return {
    id: `element.${atomicNumber}`,
    atomicNumber,
    symbol,
    nameCs,
    nameLat,
    period,
    group,
    atomicWeight: atomicNumber * 2,
    valenceConfiguration: "",
  };
}

const elements = [
  element(26, "Fe", "Železo", "Ferrum", 4, 8),
  element(1, "H", "Vodík", "Hydrogenium", 1, 1),
  element(2, "He", "Helium", "Helium", 1, 18),
  element(57, "La", "Lanthan", "Lanthanum", 6, null),
  element(25, "Mn", "Mangan", "Manganum", 4, 7),
  element(12, "Mg", "Hořčík", "Magnesium", 3, 2),
];

const symbols = (query: string, group: number | "f" | null = null, period: number | null = null) =>
  filterElements(elements, { query, group, period }).map((item) => item.symbol);

describe("filterElements", () => {
  it("lists every element by atomic number without filters", () => {
    expect(filterElements(elements, EMPTY_ELEMENT_FILTERS).map((item) => item.symbol)).toEqual([
      "H",
      "He",
      "Mg",
      "Mn",
      "Fe",
      "La",
    ]);
  });

  it("finds Czech names without diacritics and Latin names", () => {
    expect(symbols("zelezo")).toEqual(["Fe"]);
    expect(symbols("HOŘČ")).toEqual(["Mg"]);
    expect(symbols("ferr")).toEqual(["Fe"]);
  });

  it("puts an exact symbol or atomic number first", () => {
    expect(symbols("he")).toEqual(["He"]);
    expect(symbols("h")).toEqual(["H", "He", "Mg", "La"]);
    expect(symbols("25")).toEqual(["Mn"]);
    expect(symbols("ma")).toEqual(["Mg", "Mn"]);
  });

  it("narrows by group, by the rows without a group number, and by period", () => {
    expect(symbols("", 18)).toEqual(["He"]);
    expect(symbols("", "f")).toEqual(["La"]);
    expect(symbols("", null, 4)).toEqual(["Mn", "Fe"]);
    expect(symbols("m", null, 4)).toEqual(["Mn", "Fe"]);
  });

  it("returns nothing when no element matches", () => {
    expect(symbols("xyz")).toEqual([]);
  });
});
