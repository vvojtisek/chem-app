import type { PeriodicTableElement, PositionedPeriodicTableElement } from "./periodic-table-layout";

export type PeriodicTableRow = "lanthanides" | "actinides";

export type SelectionCoverage = "all" | "some" | "none";

export interface PeriodicTableColumnOption {
  readonly group: number;
  readonly elementIds: readonly string[];
}

export interface PeriodicTableRowOption {
  readonly row: PeriodicTableRow;
  readonly elementIds: readonly string[];
  readonly firstSymbol: string;
  readonly lastSymbol: string;
}

export interface PeriodicTableSelectionOptions {
  readonly columns: readonly PeriodicTableColumnOption[];
  readonly rows: readonly PeriodicTableRowOption[];
}

type ScopedElement = PeriodicTableElement & { readonly symbol: string };

export function listSelectionOptions<Element extends ScopedElement>(
  layout: readonly PositionedPeriodicTableElement<Element>[],
): PeriodicTableSelectionOptions {
  const columns = new Map<number, string[]>();
  for (const { element, position } of layout) {
    if (position.section === "main" && element.group !== null) {
      columns.set(element.group, [...(columns.get(element.group) ?? []), element.id]);
    }
  }

  const rows = (["lanthanides", "actinides"] as const).flatMap((row) => {
    const members = layout
      .filter(({ position }) => position.section === row)
      .map(({ element }) => element)
      .sort((left, right) => left.atomicNumber - right.atomicNumber);
    const first = members[0];
    const last = members.at(-1);
    return first && last
      ? [
          {
            row,
            elementIds: members.map(({ id }) => id),
            firstSymbol: first.symbol,
            lastSymbol: last.symbol,
          },
        ]
      : [];
  });

  return {
    columns: [...columns]
      .map(([group, elementIds]) => ({ group, elementIds }))
      .sort((left, right) => left.group - right.group),
    rows,
  };
}

export function defaultSelection<Element extends PeriodicTableElement>(
  layout: readonly PositionedPeriodicTableElement<Element>[],
): ReadonlySet<string> {
  return new Set(
    layout.filter(({ position }) => position.section === "main").map(({ element }) => element.id),
  );
}

export function selectionCoverage(
  selection: ReadonlySet<string>,
  elementIds: readonly string[],
): SelectionCoverage {
  const selected = elementIds.filter((id) => selection.has(id)).length;
  if (selected === 0) return "none";
  return selected === elementIds.length ? "all" : "some";
}

export function toggleSelection(
  selection: ReadonlySet<string>,
  elementIds: readonly string[],
): ReadonlySet<string> {
  const next = new Set(selection);
  if (selectionCoverage(selection, elementIds) === "all") {
    for (const id of elementIds) next.delete(id);
  } else {
    for (const id of elementIds) next.add(id);
  }
  return next;
}

export function selectElements<Element extends PeriodicTableElement>(
  layout: readonly PositionedPeriodicTableElement<Element>[],
  selection: ReadonlySet<string>,
): readonly Element[] {
  return layout.filter(({ element }) => selection.has(element.id)).map(({ element }) => element);
}

export function drawSeries<Item>(
  items: readonly Item[],
  limit: number,
  random: () => number,
): readonly Item[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(random() * (index + 1)));
    const current = shuffled[index];
    const swapped = shuffled[swapIndex];
    if (current === undefined || swapped === undefined) continue;
    shuffled[index] = swapped;
    shuffled[swapIndex] = current;
  }

  return shuffled.slice(0, Math.max(0, Math.min(limit, shuffled.length)));
}
