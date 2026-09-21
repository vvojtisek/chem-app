import { curatedElements } from "@inorganic/content/runtime";
import { describe, expect, it } from "vitest";

import {
  createPeriodicTableLayout,
  createPeriodicTablePositionKey,
  describePeriodicTablePosition,
} from "./periodic-table-layout";

describe("createPeriodicTableLayout", () => {
  it("assigns every reviewed element a unique grid position", () => {
    const layout = createPeriodicTableLayout(curatedElements);
    const positionKeys = layout.map(({ position }) => createPeriodicTablePositionKey(position));

    expect(layout).toHaveLength(118);
    expect(new Set(positionKeys)).toHaveLength(118);
  });

  it("uses the accepted Sc-Y-Lu-Lr group-three placement", () => {
    const positionsBySymbol = new Map(
      createPeriodicTableLayout(curatedElements).map(({ element, position }) => [
        element.symbol,
        position,
      ]),
    );

    expect(positionsBySymbol.get("Lu")).toEqual({ section: "main", row: 6, column: 3 });
    expect(positionsBySymbol.get("Lr")).toEqual({ section: "main", row: 7, column: 3 });
    expect(positionsBySymbol.get("La")).toEqual({
      section: "lanthanides",
      row: 1,
      column: 3,
    });
    expect(positionsBySymbol.get("Ac")).toEqual({ section: "actinides", row: 1, column: 3 });
  });

  it("labels main-grid and f-block positions for accessible controls", () => {
    expect(describePeriodicTablePosition({ section: "main", row: 2, column: 18 })).toBe(
      "Perioda 2, skupina 18",
    );
    expect(describePeriodicTablePosition({ section: "lanthanides", row: 1, column: 3 })).toBe(
      "Lanthanidy, pozice 1",
    );
  });
});
