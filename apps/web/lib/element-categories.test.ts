import { classifyElementCategory, ELEMENT_CATEGORIES } from "@inorganic/chemistry";
import { curatedElements } from "@inorganic/content/runtime";
import { describe, expect, it } from "vitest";

import { ELEMENT_CATEGORY_OPTIONS } from "./element-categories";

describe("element categories", () => {
  it("labels every category once, in the shared order", () => {
    expect(ELEMENT_CATEGORY_OPTIONS.map((option) => option.id)).toEqual(ELEMENT_CATEGORIES);
    expect(new Set(ELEMENT_CATEGORY_OPTIONS.map((option) => option.label)).size).toBe(
      ELEMENT_CATEGORIES.length,
    );
  });

  it("keeps the category sizes of the reviewed element table", () => {
    const counts = new Map<string, number>();
    for (const element of curatedElements) {
      const category = classifyElementCategory(element);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }

    expect(curatedElements).toHaveLength(118);
    expect(Object.fromEntries(counts)).toEqual({
      "alkali-metal": 6,
      "alkaline-earth-metal": 6,
      "transition-metal": 38,
      "other-metal": 11,
      metalloid: 7,
      nonmetal: 7,
      halogen: 6,
      "noble-gas": 7,
      "lanthanoid-actinoid": 30,
    });
  });
});
