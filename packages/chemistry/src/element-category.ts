/**
 * Element categories used to group and colour elements in study views. The ids are stable
 * contracts; Czech labels belong to the presentation layer.
 */
export const ELEMENT_CATEGORIES = [
  "alkali-metal",
  "alkaline-earth-metal",
  "transition-metal",
  "other-metal",
  "metalloid",
  "nonmetal",
  "halogen",
  "noble-gas",
  "lanthanoid-actinoid",
] as const;

export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number];

export interface ElementCategoryInput {
  readonly atomicNumber: number;
  /** IUPAC group 1–18, or null for elements the curriculum lists outside the main table. */
  readonly group: number | null;
}

const METALLOIDS: ReadonlySet<number> = new Set([5, 14, 32, 33, 51, 52, 84]);
const NONMETALS: ReadonlySet<number> = new Set([1, 6, 7, 8, 15, 16, 34]);

function isLanthanoidOrActinoid(atomicNumber: number): boolean {
  return (atomicNumber >= 57 && atomicNumber <= 71) || (atomicNumber >= 89 && atomicNumber <= 103);
}

/**
 * Curriculum convention (pending chemistry-SME confirmation, see IMPLEMENTATION_PLAN.md):
 * La–Lu and Ac–Lr are lanthanoids/actinoids regardless of group; group 1 without H, group 2
 * (Be and Mg included), groups 3–12, 17 and 18 by group; B, Si, Ge, As, Sb, Te and Po are
 * metalloids; H, C, N, O, P, S and Se are nonmetals; the remaining elements are other metals.
 */
export function classifyElementCategory(element: ElementCategoryInput): ElementCategory {
  const { atomicNumber, group } = element;
  if (isLanthanoidOrActinoid(atomicNumber)) return "lanthanoid-actinoid";
  if (group === 1 && atomicNumber !== 1) return "alkali-metal";
  if (group === 2) return "alkaline-earth-metal";
  if (group === 18) return "noble-gas";
  if (group === 17) return "halogen";
  if (group !== null && group >= 3 && group <= 12) return "transition-metal";
  if (METALLOIDS.has(atomicNumber)) return "metalloid";
  if (NONMETALS.has(atomicNumber)) return "nonmetal";
  return "other-metal";
}
