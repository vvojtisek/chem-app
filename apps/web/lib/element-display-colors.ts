import { classifyElementCategory, type ElementCategory } from "@inorganic/chemistry";
import { curatedElements } from "@inorganic/content/runtime";
import type { CSSProperties } from "react";

/** References the periodic table's theme tokens; no competing per-symbol palette. */
const categoryColors: Readonly<Record<ElementCategory, string>> = {
  "alkali-metal": "var(--category-alkali-metal)",
  "alkaline-earth-metal": "var(--category-alkaline-earth-metal)",
  "transition-metal": "var(--category-transition-metal)",
  "other-metal": "var(--category-other-metal)",
  metalloid: "var(--category-metalloid)",
  nonmetal: "var(--category-nonmetal)",
  halogen: "var(--category-halogen)",
  "noble-gas": "var(--category-noble-gas)",
  "lanthanoid-actinoid": "var(--ink-2)",
};
const categories = new Map(
  curatedElements.map((element) => [element.symbol, classifyElementCategory(element)]),
);

export function getElementColor(symbol: string): string {
  const category = categories.get(symbol);
  return category ? categoryColors[category] : "var(--ink-2)";
}

export function elementCategoryColorStyle(
  symbol: string,
): CSSProperties & { "--element-category-color": string } {
  return { "--element-category-color": getElementColor(symbol) };
}
