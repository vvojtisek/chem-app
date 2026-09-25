import { normalizeAnswerWithoutDiacritics } from "@inorganic/chemistry";
import type { ElementFlashcardData } from "@inorganic/content/runtime";

/** "f" stands for the lanthanoid and actinoid rows, which have no group number in the data. */
export type ElementGroupFilter = number | "f" | null;

export interface ElementFilters {
  readonly query: string;
  readonly group: ElementGroupFilter;
  readonly period: number | null;
}

export const EMPTY_ELEMENT_FILTERS: ElementFilters = { query: "", group: null, period: null };

function matchesGroup(element: ElementFlashcardData, group: ElementGroupFilter): boolean {
  if (group === null) return true;
  return group === "f" ? element.group === null : element.group === group;
}

/**
 * Elements matching a Czech or Latin name (case and diacritics ignored), a symbol or an atomic
 * number, within the chosen group and period. Exact symbol or number hits come first, then names
 * that start with the query, then the rest, each by atomic number.
 */
export function filterElements(
  elements: readonly ElementFlashcardData[],
  filters: ElementFilters,
): readonly ElementFlashcardData[] {
  const query = normalizeAnswerWithoutDiacritics(filters.query);
  const scoped = elements.filter(
    (element) =>
      matchesGroup(element, filters.group) &&
      (filters.period === null || element.period === filters.period),
  );
  if (!query) return [...scoped].sort((left, right) => left.atomicNumber - right.atomicNumber);

  const ranked: { element: ElementFlashcardData; rank: number }[] = [];
  for (const element of scoped) {
    const symbol = element.symbol.toLocaleLowerCase("cs-CZ");
    const names = [element.nameCs, element.nameLat].map(normalizeAnswerWithoutDiacritics);
    const rank =
      symbol === query || String(element.atomicNumber) === query
        ? 0
        : names.some((name) => name.startsWith(query))
          ? 1
          : names.some((name) => name.includes(query))
            ? 2
            : null;
    if (rank !== null) ranked.push({ element, rank });
  }
  return ranked
    .sort(
      (left, right) =>
        left.rank - right.rank || left.element.atomicNumber - right.element.atomicNumber,
    )
    .map(({ element }) => element);
}
