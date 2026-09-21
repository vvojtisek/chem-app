export interface PeriodicTableElement {
  readonly id: string;
  readonly atomicNumber: number;
  readonly period: number;
  readonly group: number | null;
}

export type PeriodicTableSection = "main" | "lanthanides" | "actinides";

export interface PeriodicTablePosition {
  readonly section: PeriodicTableSection;
  readonly row: number;
  readonly column: number;
}

export interface PositionedPeriodicTableElement<Element extends PeriodicTableElement> {
  readonly element: Element;
  readonly position: PeriodicTablePosition;
}

export function createPeriodicTableLayout<Element extends PeriodicTableElement>(
  elements: readonly Element[],
): readonly PositionedPeriodicTableElement<Element>[] {
  const fBlockCounts = new Map<number, number>();
  const occupiedPositions = new Set<string>();

  return elements.map((element) => {
    const position: PeriodicTablePosition =
      element.group === null
        ? createFBlockPosition(element, fBlockCounts)
        : { section: "main", row: element.period, column: element.group };
    const key = createPeriodicTablePositionKey(position);

    if (occupiedPositions.has(key)) {
      throw new Error(`Duplicate periodic-table position: ${key}.`);
    }

    occupiedPositions.add(key);
    return { element, position };
  });
}

export function createPeriodicTablePositionKey(position: PeriodicTablePosition): string {
  return `${position.section}:${position.row}:${position.column}`;
}

export function describePeriodicTablePosition(position: PeriodicTablePosition): string {
  if (position.section === "main") {
    return `Perioda ${position.row}, skupina ${position.column}`;
  }

  const rowName = position.section === "lanthanides" ? "Lanthanidy" : "Aktinidy";
  return `${rowName}, pozice ${position.column - 2}`;
}

function createFBlockPosition<Element extends PeriodicTableElement>(
  element: Element,
  fBlockCounts: Map<number, number>,
): PeriodicTablePosition {
  const section = element.period === 6 ? "lanthanides" : "actinides";
  const count = fBlockCounts.get(element.period) ?? 0;
  fBlockCounts.set(element.period, count + 1);

  return {
    section,
    row: 1,
    column: count + 3,
  };
}
