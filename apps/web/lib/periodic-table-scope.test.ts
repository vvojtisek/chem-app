import { curatedElements } from "@inorganic/content/runtime";
import { describe, expect, it } from "vitest";

import { createPeriodicTableLayout } from "./periodic-table-layout";
import {
  defaultSelection,
  drawSeries,
  listSelectionOptions,
  selectElements,
  selectionCoverage,
  toggleSelection,
} from "./periodic-table-scope";

const layout = createPeriodicTableLayout(curatedElements);
const options = listSelectionOptions(layout);
const symbolsOf = (elements: readonly { readonly symbol: string }[]) =>
  elements.map(({ symbol }) => symbol);
const idOf = (symbol: string) => {
  const element = curatedElements.find((candidate) => candidate.symbol === symbol);
  if (!element) throw new Error(`Unknown symbol ${symbol}.`);
  return element.id;
};
const column = (group: number) =>
  options.columns.find((option) => option.group === group)?.elementIds ?? [];
const row = (name: "lanthanides" | "actinides") =>
  options.rows.find((option) => option.row === name)?.elementIds ?? [];

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

describe("periodic-table practice selection", () => {
  it("offers columns for groups 1-18 and both bottom rows derived from the reviewed data", () => {
    expect(options.columns.map(({ group }) => group)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
    expect(
      options.rows.map(({ row, elementIds, firstSymbol, lastSymbol }) => [
        row,
        elementIds.length,
        firstSymbol,
        lastSymbol,
      ]),
    ).toEqual([
      ["lanthanides", 14, "La", "Yb"],
      ["actinides", 14, "Ac", "No"],
    ]);
  });

  it("follows the group-3 ADR: column 3 is Sc, Y, Lu and Lr; La and Ac belong to the bottom rows", () => {
    expect(column(3)).toEqual(["Sc", "Y", "Lu", "Lr"].map(idOf));
    expect(row("lanthanides")).toContain(idOf("La"));
    expect(row("actinides")).toContain(idOf("Ac"));
    expect([...row("lanthanides"), ...row("actinides")]).not.toContain(idOf("Lu"));
    expect([...row("lanthanides"), ...row("actinides")]).not.toContain(idOf("Lr"));
  });

  it("assigns every element to exactly one column or bottom row", () => {
    const all = [
      ...options.columns.flatMap(({ elementIds }) => elementIds),
      ...options.rows.flatMap(({ elementIds }) => elementIds),
    ];

    expect(all).toHaveLength(118);
    expect(new Set(all).size).toBe(118);
  });

  it("selects every group by default and leaves both bottom rows out", () => {
    const selection = defaultSelection(layout);

    expect(selection.size).toBe(90);
    expect(selectionCoverage(selection, column(3))).toBe("all");
    expect(selectionCoverage(selection, row("lanthanides"))).toBe("none");
    expect(selectionCoverage(selection, row("actinides"))).toBe("none");
  });

  it("toggles a whole column on unless it is already fully selected", () => {
    const partial = new Set([idOf("H"), idOf("Na")]);
    expect(selectionCoverage(partial, column(1))).toBe("some");

    const full = toggleSelection(partial, column(1));
    expect(selectionCoverage(full, column(1))).toBe("all");
    expect(symbolsOf(selectElements(layout, full))).toEqual([
      "H",
      "Li",
      "Na",
      "K",
      "Rb",
      "Cs",
      "Fr",
    ]);

    const cleared = toggleSelection(full, column(1));
    expect(cleared.size).toBe(0);
  });

  it("keeps the other selected elements when a column or row is toggled", () => {
    const selection = toggleSelection(new Set([idOf("Cl")]), row("actinides"));

    expect(selection.size).toBe(15);
    expect(toggleSelection(selection, row("actinides"))).toEqual(new Set([idOf("Cl")]));
  });

  it("returns the selected elements in atomic-number order and nothing for an empty selection", () => {
    const selection = new Set([idOf("La"), idOf("H"), idOf("Fe")]);

    expect(symbolsOf(selectElements(layout, selection))).toEqual(["H", "Fe", "La"]);
    expect(selectElements(layout, new Set())).toEqual([]);
  });
});

describe("drawSeries", () => {
  const all = selectElements(layout, new Set(curatedElements.map(({ id }) => id)));

  it("draws min(10, n) distinct items", () => {
    const series = drawSeries(all, 10, seededRandom(1));
    expect(series).toHaveLength(10);
    expect(new Set(series).size).toBe(10);
    expect(drawSeries(all.slice(0, 4), 10, seededRandom(1))).toHaveLength(4);
    expect(drawSeries(all.slice(0, 1), 10, seededRandom(1))).toHaveLength(1);
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
