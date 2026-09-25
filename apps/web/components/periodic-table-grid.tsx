"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { Fragment, type ReactNode } from "react";

import {
  describePeriodicTablePosition,
  type PeriodicTablePosition,
  type PeriodicTableSection,
  type PositionedPeriodicTableElement,
} from "@/lib/periodic-table-layout";

export type PeriodicTableCellResult = "solved" | "incorrect";

type PositionedElement = PositionedPeriodicTableElement<ElementFlashcardData>;

interface PeriodicTableGridProps {
  readonly layout: readonly PositionedElement[];
  readonly onSelect?: ((position: PeriodicTablePosition) => void) | undefined;
  readonly cellResult?: ((elementId: string) => PeriodicTableCellResult | null) | undefined;
}

const SERIES_LABELS: Readonly<Record<PeriodicTableSeriesSection, string>> = {
  lanthanides: "Lanthanidy",
  actinides: "Aktinidy",
};

/**
 * The blind table used during exercises. Every unanswered cell looks the same („?“) so the
 * table never hints where the sought element is; only answered cells differ.
 */
export function PeriodicTableGrid({ layout, onSelect, cellResult }: PeriodicTableGridProps) {
  return (
    <PeriodicTableFrame
      layout={layout}
      legend="Slepá periodická tabulka"
      renderCell={({ element, position }) => (
        <PositionCell
          element={element}
          onSelect={onSelect}
          position={position}
          result={cellResult?.(element.id) ?? null}
        />
      )}
    />
  );
}

export type PeriodicTableSeriesSection = Exclude<PeriodicTableSection, "main">;

interface PeriodicTableFrameProps {
  readonly layout: readonly PositionedElement[];
  readonly legend: string;
  readonly renderCell: (positioned: PositionedElement) => ReactNode;
  readonly columnHeader?: ((group: number) => ReactNode) | undefined;
  readonly seriesHeading?:
    | ((section: PeriodicTableSeriesSection, label: string) => ReactNode)
    | undefined;
}

export function PeriodicTableFrame({
  layout,
  legend,
  renderCell,
  columnHeader,
  seriesHeading = defaultSeriesHeading,
}: PeriodicTableFrameProps) {
  const mainElements = layout.filter(({ position }) => position.section === "main");
  const columns = [...new Set(mainElements.map(({ position }) => position.column))].sort(
    (left, right) => left - right,
  );
  const renderCells = (elements: readonly PositionedElement[]) =>
    elements.map((positioned) => (
      <Fragment key={positioned.element.id}>{renderCell(positioned)}</Fragment>
    ));

  return (
    <div className="mt-6">
      {/* Keyboard focus lets Safari users scroll the table when its cells are not interactive. */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: A scrollable region needs keyboard access even without enabled cells. */}
      <section aria-label="Periodická tabulka" className="overflow-x-auto pb-3" tabIndex={0}>
        <div className="min-w-180">
          {columnHeader ? (
            <div className="mb-3 grid grid-cols-18 gap-1 border-b border-line-strong pb-3">
              {columns.map((column) => (
                <div key={column} style={{ gridColumn: column }}>
                  {columnHeader(column)}
                </div>
              ))}
            </div>
          ) : null}
          <fieldset className="grid grid-cols-18 gap-1">
            <legend className="sr-only">{legend}</legend>
            {renderCells(mainElements)}
          </fieldset>
          {(["lanthanides", "actinides"] as const).map((section) => (
            <section aria-label={SERIES_LABELS[section]} className="mt-3" key={section}>
              {seriesHeading(section, SERIES_LABELS[section])}
              <div className="grid grid-cols-18 gap-1">
                {renderCells(layout.filter(({ position }) => position.section === section))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function defaultSeriesHeading(_section: PeriodicTableSeriesSection, label: string): ReactNode {
  return <h3 className="mb-2 text-sm font-semibold text-ink-2">{label}</h3>;
}

function PositionCell({
  element,
  onSelect,
  position,
  result,
}: {
  readonly element: ElementFlashcardData;
  readonly onSelect: ((position: PeriodicTablePosition) => void) | undefined;
  readonly position: PeriodicTablePosition;
  readonly result: PeriodicTableCellResult | null;
}) {
  return (
    <button
      aria-label={cellLabel(describePeriodicTablePosition(position), element.symbol, result)}
      className={`min-h-11 rounded-md text-sm font-semibold ${CELL_STYLES[result ?? "blank"]}`}
      data-cell-result={result ?? undefined}
      data-element-id={element.id}
      disabled={!onSelect}
      onClick={onSelect ? () => onSelect(position) : undefined}
      style={{
        gridColumn: position.column,
        gridRow: position.section === "main" ? position.row : 1,
      }}
      type="button"
    >
      <span aria-hidden="true">{cellMark(element.symbol, result)}</span>
    </button>
  );
}

const CELL_STYLES: Readonly<Record<PeriodicTableCellResult | "blank", string>> = {
  solved: "border border-good bg-good-soft text-good",
  incorrect: "border border-bad bg-bad-soft text-bad",
  blank: "border border-line-strong bg-surface-2 text-ink-2",
};

function cellLabel(
  description: string,
  symbol: string,
  result: PeriodicTableCellResult | null,
): string {
  if (result === "solved") return `${description}: ${symbol}, vyřešeno`;
  if (result === "incorrect") return `${description}: chybná odpověď`;
  return description;
}

function cellMark(symbol: string, result: PeriodicTableCellResult | null): string {
  if (result === "solved") return symbol;
  if (result === "incorrect") return "✗";
  return "?";
}
