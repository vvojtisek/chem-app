import type { PeriodicTableElement, PositionedPeriodicTableElement } from "./periodic-table-layout";

export type PeriodicTableRow = "lanthanides" | "actinides";

export interface PeriodicTableScope {
  readonly groups: readonly number[];
  readonly rows: readonly PeriodicTableRow[];
}

export interface PeriodicTableGroupOption {
  readonly group: number;
  readonly count: number;
}

export interface PeriodicTableRowOption {
  readonly row: PeriodicTableRow;
  readonly count: number;
  readonly firstSymbol: string;
  readonly lastSymbol: string;
}

export interface PeriodicTableScopeOptions {
  readonly groups: readonly PeriodicTableGroupOption[];
  readonly rows: readonly PeriodicTableRowOption[];
}

type ScopedElement = PeriodicTableElement & { readonly symbol: string };

export const SERIES_LENGTH = 10;

export function listScopeOptions<Element extends ScopedElement>(
  layout: readonly PositionedPeriodicTableElement<Element>[],
): PeriodicTableScopeOptions {
  const groupCounts = new Map<number, number>();
  for (const { element, position } of layout) {
    if (position.section === "main" && element.group !== null) {
      groupCounts.set(element.group, (groupCounts.get(element.group) ?? 0) + 1);
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
      ? [{ row, count: members.length, firstSymbol: first.symbol, lastSymbol: last.symbol }]
      : [];
  });

  return {
    groups: [...groupCounts]
      .map(([group, count]) => ({ group, count }))
      .sort((left, right) => left.group - right.group),
    rows,
  };
}

export function fullScope(options: PeriodicTableScopeOptions): PeriodicTableScope {
  return {
    groups: options.groups.map(({ group }) => group),
    rows: options.rows.map(({ row }) => row),
  };
}

export function selectScopeElements<Element extends ScopedElement>(
  layout: readonly PositionedPeriodicTableElement<Element>[],
  scope: PeriodicTableScope,
): readonly Element[] {
  const groups = new Set(scope.groups);
  const rows = new Set<string>(scope.rows);

  return layout
    .filter(({ element, position }) =>
      position.section === "main"
        ? element.group !== null && groups.has(element.group)
        : rows.has(position.section),
    )
    .map(({ element }) => element);
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
