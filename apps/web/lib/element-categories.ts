import { ELEMENT_CATEGORIES, type ElementCategory } from "@inorganic/chemistry";

/** Czech labels for element categories, in the order used by legends, filters and indexes. */
export const ELEMENT_CATEGORY_LABELS: Readonly<Record<ElementCategory, string>> = {
  "alkali-metal": "Alkalické kovy",
  "alkaline-earth-metal": "Kovy alkalických zemin",
  "transition-metal": "Přechodné kovy",
  "other-metal": "Kovy",
  metalloid: "Polokovy",
  nonmetal: "Nekovy",
  halogen: "Halogeny",
  "noble-gas": "Vzácné plyny",
  "lanthanoid-actinoid": "Lanthanoidy a aktinoidy",
};

export interface ElementCategoryOption {
  readonly id: ElementCategory;
  readonly label: string;
}

export const ELEMENT_CATEGORY_OPTIONS: readonly ElementCategoryOption[] = ELEMENT_CATEGORIES.map(
  (id) => ({ id, label: ELEMENT_CATEGORY_LABELS[id] }),
);
