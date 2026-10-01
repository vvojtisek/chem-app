import { describe, expect, it } from "vitest";

import { classifyElementCategory, ELEMENT_CATEGORIES } from "./element-category";

describe("classifyElementCategory", () => {
  it.each([
    ["H", 1, 1, "nonmetal"],
    ["Li", 3, 1, "alkali-metal"],
    ["Fr", 87, 1, "alkali-metal"],
    ["Be", 4, 2, "alkaline-earth-metal"],
    ["Mg", 12, 2, "alkaline-earth-metal"],
    ["Ra", 88, 2, "alkaline-earth-metal"],
    ["Sc", 21, 3, "transition-metal"],
    ["Fe", 26, 8, "transition-metal"],
    ["Zn", 30, 12, "transition-metal"],
    ["Hg", 80, 12, "transition-metal"],
    ["La", 57, null, "lanthanoid-actinoid"],
    ["Lu", 71, 3, "lanthanoid-actinoid"],
    ["Ac", 89, null, "lanthanoid-actinoid"],
    ["Lr", 103, 3, "lanthanoid-actinoid"],
    ["Rf", 104, 4, "transition-metal"],
    ["B", 5, 13, "metalloid"],
    ["Si", 14, 14, "metalloid"],
    ["Te", 52, 16, "metalloid"],
    ["Po", 84, 16, "metalloid"],
    ["Al", 13, 13, "other-metal"],
    ["Pb", 82, 14, "other-metal"],
    ["Bi", 83, 15, "other-metal"],
    ["Lv", 116, 16, "other-metal"],
    ["C", 6, 14, "nonmetal"],
    ["Se", 34, 16, "nonmetal"],
    ["F", 9, 17, "halogen"],
    ["At", 85, 17, "halogen"],
    ["Ts", 117, 17, "halogen"],
    ["He", 2, 18, "noble-gas"],
    ["Og", 118, 18, "noble-gas"],
  ] as const)(
    "classifies %s (Z = %i, group %s) as %s",
    (_symbol, atomicNumber, group, expected) => {
      expect(classifyElementCategory({ atomicNumber, group })).toBe(expected);
    },
  );

  it("does not treat hydrogen as an alkali metal although it sits in group 1", () => {
    expect(classifyElementCategory({ atomicNumber: 1, group: 1 })).not.toBe("alkali-metal");
  });

  it("returns only declared categories", () => {
    for (let atomicNumber = 1; atomicNumber <= 118; atomicNumber += 1) {
      const category = classifyElementCategory({ atomicNumber, group: null });
      expect(ELEMENT_CATEGORIES).toContain(category);
    }
  });
});
