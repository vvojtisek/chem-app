import { curatedElements } from "@inorganic/content/runtime";
import { describe, expect, it } from "vitest";

import { createPeriodicTableLayout } from "./periodic-table-layout";
import {
  drawSeries,
  fullScope,
  listScopeOptions,
  SERIES_LENGTH,
  selectScopeElements,
} from "./periodic-table-scope";

const layout = createPeriodicTableLayout(curatedElements);
const options = listScopeOptions(layout);
const symbolsOf = (elements: readonly { readonly symbol: string }[]) =>
  elements.map(({ symbol }) => symbol);

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe("periodic-table practice scope", () => {
  it("offers groups 1-18 and both bottom rows derived from the reviewed data", () => {
    expect(options.groups.map(({ group }) => group)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
    expect(options.rows).toEqual([
      { row: "lanthanides", count: 14, firstSymbol: "La", lastSymbol: "Yb" },
      { row: "actinides", count: 14, firstSymbol: "Ac", lastSymbol: "No" },
    ]);
  });

  it("selects exactly the union of the chosen groups", () => {
    expect(symbolsOf(selectScopeElements(layout, { groups: [1, 17], rows: [] }))).toEqual([
      "H",
      "Li",
      "F",
      "Na",
      "Cl",
      "K",
      "Br",
      "Rb",
      "I",
      "Cs",
      "At",
      "Fr",
      "Ts",
    ]);
  });

  it("follows the group-3 ADR: Sc, Y, Lu and Lr; La and Ac belong to the bottom rows", () => {
    expect(symbolsOf(selectScopeElements(layout, { groups: [3], rows: [] }))).toEqual([
      "Sc",
      "Y",
      "Lu",
      "Lr",
    ]);
    const bottomRows = symbolsOf(
      selectScopeElements(layout, { groups: [], rows: ["lanthanides", "actinides"] }),
    );
    expect(bottomRows).toContain("La");
    expect(bottomRows).toContain("Ac");
    expect(bottomRows).not.toContain("Lu");
    expect(bottomRows).not.toContain("Lr");
  });

  it("covers all 118 elements exactly once in the full scope", () => {
    const all = selectScopeElements(layout, fullScope(options));

    expect(all).toHaveLength(118);
    expect(new Set(all.map(({ id }) => id)).size).toBe(118);
  });

  it("selects nothing for an empty scope", () => {
    expect(selectScopeElements(layout, { groups: [], rows: [] })).toEqual([]);
  });
});

describe("drawSeries", () => {
  const all = selectScopeElements(layout, fullScope(options));

  it("draws min(10, n) distinct items", () => {
    const series = drawSeries(all, SERIES_LENGTH, seededRandom(1));
    expect(series).toHaveLength(10);
    expect(new Set(series).size).toBe(10);
    expect(drawSeries(all.slice(0, 4), SERIES_LENGTH, seededRandom(1))).toHaveLength(4);
    expect(drawSeries(all.slice(0, 1), SERIES_LENGTH, seededRandom(1))).toHaveLength(1);
  });

  it("is deterministic for an injected random source", () => {
    expect(drawSeries(all, 10, seededRandom(7))).toEqual(drawSeries(all, 10, seededRandom(7)));
  });

  it("keeps the input order when the random source always returns its maximum", () => {
    expect(drawSeries(all, 10, () => 0.999_999)).toEqual(all.slice(0, 10));
  });

  it("is not limited to the first ten elements of the filtered list across series", () => {
    const drawn = new Set<string>();
    for (let seed = 1; seed <= 30; seed += 1) {
      for (const element of drawSeries(all, 10, seededRandom(seed))) drawn.add(element.id);
    }

    expect(drawn.size).toBeGreaterThan(100);
  });

  it("tolerates a random source that returns exactly 1", () => {
    expect(new Set(drawSeries(all, 10, () => 1)).size).toBe(10);
  });
});
