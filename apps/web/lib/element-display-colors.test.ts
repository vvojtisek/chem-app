import { curatedElements } from "@inorganic/content/runtime";
import { describe, expect, it } from "vitest";
import { getElementColor } from "./element-display-colors";

describe("shared periodic-table colors", () => {
  it("references category tokens rather than maintaining CPK-like hex overrides", () => {
    expect(getElementColor("Na")).toBe("var(--category-alkali-metal)");
    expect(getElementColor("B")).toBe("var(--category-metalloid)");
    expect(getElementColor("O")).toBe("var(--category-nonmetal)");
    expect(getElementColor("H")).toBe(getElementColor("O"));
    expect(getElementColor("Cl")).toBe("var(--category-halogen)");
    expect(getElementColor("La")).toBe("var(--ink-2)");
    expect(getElementColor("Unknown")).toBe("var(--ink-2)");
    for (const element of curatedElements)
      expect(getElementColor(element.symbol)).toMatch(/^var\(--(?:category-[a-z-]+|ink-2)\)$/u);
  });
});
