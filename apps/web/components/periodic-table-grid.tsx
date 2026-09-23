"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { Fragment, type ReactNode, useEffect, useRef } from "react";

import {
  describePeriodicTablePosition,
  type PeriodicTablePosition,
  type PeriodicTableSection,
  type PositionedPeriodicTableElement,
} from "@/lib/periodic-table-layout";

export type PeriodicTableCellResult = "solved" | "incorrect";

export interface PeriodicTableCellState {
  readonly current: boolean;
  readonly result: PeriodicTableCellResult | null;
  readonly excluded?: boolean;
}

type PositionedElement = PositionedPeriodicTableElement<ElementFlashcardData>;

interface PeriodicTableGridProps {
  readonly layout: readonly PositionedElement[];
  readonly onSelect?: ((position: PeriodicTablePosition) => void) | undefined;
  readonly cellState?: ((elementId: string) => PeriodicTableCellState) | undefined;
}

const BLANK_CELL: PeriodicTableCellState = { current: false, result: null };
const REVEAL_MARGIN_PX = 8;
const SERIES_LABELS: Readonly<Record<PeriodicTableSeriesSection, string>> = {
  lanthanides: "Lanthanidy",
  actinides: "Aktinidy",
};

export function PeriodicTableGrid({ layout, onSelect, cellState }: PeriodicTableGridProps) {
  const stateOf = (elementId: string) => cellState?.(elementId) ?? BLANK_CELL;
  const currentElementId = layout.find(({ element }) => stateOf(element.id).current)?.element.id;

  return (
    <PeriodicTableFrame
      layout={layout}
      legend="Slepá periodická tabulka"
      renderCell={({ element, position }) => (
        <PositionCell
          element={element}
          onSelect={onSelect}
          position={position}
          state={stateOf(element.id)}
        />
      )}
      revealElementId={currentElementId}
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
  readonly revealElementId?: string | undefined;
}

export function PeriodicTableFrame({
  layout,
  legend,
  renderCell,
  columnHeader,
  seriesHeading = defaultSeriesHeading,
  revealElementId,
}: PeriodicTableFrameProps) {
  const scrollContainerRef = useRef<HTMLElement>(null);
  const mainElements = layout.filter(({ position }) => position.section === "main");
  const renderCells = (elements: readonly PositionedElement[]) =>
    elements.map((positioned) => (
      <Fragment key={positioned.element.id}>{renderCell(positioned)}</Fragment>
    ));
  const columns = [...new Set(mainElements.map(({ position }) => position.column))].sort(
    (left, right) => left - right,
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || revealElementId === undefined) return;

    const cell = [...container.querySelectorAll<HTMLElement>("[data-element-id]")].find(
      (candidate) => candidate.dataset.elementId === revealElementId,
    );
    if (cell) revealHorizontally(container, cell);
  }, [revealElementId]);

  return (
    <div className="mt-6">
      <section
        aria-label="Periodická tabulka"
        className="overflow-x-auto pb-3"
        ref={scrollContainerRef}
      >
        <div className="min-w-180">
          {columnHeader ? (
            <div className="mb-1 grid grid-cols-18 gap-1">
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
  return <h3 className="mb-2 text-sm font-semibold text-slate-700">{label}</h3>;
}

function PositionCell({
  element,
  onSelect,
  position,
  state,
}: {
  readonly element: ElementFlashcardData;
  readonly onSelect: ((position: PeriodicTablePosition) => void) | undefined;
  readonly position: PeriodicTablePosition;
  readonly state: PeriodicTableCellState;
}) {
  return (
    <button
      aria-label={cellLabel(describePeriodicTablePosition(position), element.symbol, state)}
      className={`min-h-11 rounded-md text-sm font-semibold ${cellClassName(state)}`}
      data-cell-result={state.result ?? undefined}
      data-element-id={element.id}
      disabled={!onSelect}
      onClick={onSelect ? () => onSelect(position) : undefined}
      style={{
        gridColumn: position.column,
        gridRow: position.section === "main" ? position.row : 1,
      }}
      type="button"
    >
      <span aria-hidden="true">{cellMark(element.symbol, state)}</span>
    </button>
  );
}

function cellLabel(description: string, symbol: string, state: PeriodicTableCellState): string {
  const prefix = state.current ? "Vybraná pozice: " : "";
  if (state.result === "solved") return `${prefix}${description}: ${symbol}, vyřešeno`;
  if (state.result === "incorrect") return `${prefix}${description}: chybná odpověď`;
  if (state.excluded) return `${prefix}${description}: mimo výběr`;
  return `${prefix}${description}`;
}

function cellMark(symbol: string, state: PeriodicTableCellState): string {
  if (state.result === "solved") return symbol;
  if (state.result === "incorrect") return "✗";
  if (state.current) return "●";
  return state.excluded ? "" : "?";
}

function cellClassName(state: PeriodicTableCellState): string {
  const emphasis =
    "border-2 border-sky-700 ring-2 ring-sky-600/40 motion-safe:animate-[current-cell-pulse_1.6s_ease-in-out_infinite]";
  if (state.result === "solved") {
    return `bg-emerald-100 text-emerald-950 ${state.current ? emphasis : "border border-emerald-300"}`;
  }
  if (state.result === "incorrect") {
    return `bg-rose-50 text-rose-900 ${state.current ? emphasis : "border border-rose-300"}`;
  }
  if (state.current) return `bg-sky-50 text-sky-950 ${emphasis}`;
  if (state.excluded) return "border border-slate-300 bg-slate-50 opacity-35 grayscale";
  return "border border-slate-300 bg-slate-50 text-slate-700";
}

function revealHorizontally(container: HTMLElement, cell: HTMLElement): void {
  const containerBox = container.getBoundingClientRect();
  const cellBox = cell.getBoundingClientRect();

  if (cellBox.left < containerBox.left) {
    container.scrollLeft -= containerBox.left - cellBox.left + REVEAL_MARGIN_PX;
  } else if (cellBox.right > containerBox.right) {
    container.scrollLeft += cellBox.right - containerBox.right + REVEAL_MARGIN_PX;
  }
}
