"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useEffect, useRef } from "react";

import {
  describePeriodicTablePosition,
  type PeriodicTablePosition,
  type PositionedPeriodicTableElement,
} from "@/lib/periodic-table-layout";

export type PeriodicTableCellResult = "solved" | "incorrect";

export interface PeriodicTableCellState {
  readonly current: boolean;
  readonly result: PeriodicTableCellResult | null;
}

type PositionedElement = PositionedPeriodicTableElement<ElementFlashcardData>;

interface PeriodicTableGridProps {
  readonly layout: readonly PositionedElement[];
  readonly onSelect?: ((position: PeriodicTablePosition) => void) | undefined;
  readonly cellState?: ((elementId: string) => PeriodicTableCellState) | undefined;
}

const BLANK_CELL: PeriodicTableCellState = { current: false, result: null };
const REVEAL_MARGIN_PX = 8;

export function PeriodicTableGrid({ layout, onSelect, cellState }: PeriodicTableGridProps) {
  const scrollContainerRef = useRef<HTMLElement>(null);
  const stateOf = (elementId: string) => cellState?.(elementId) ?? BLANK_CELL;
  const currentElementId = layout.find(({ element }) => stateOf(element.id).current)?.element.id;
  const mainElements = layout.filter(({ position }) => position.section === "main");
  const lanthanides = layout.filter(({ position }) => position.section === "lanthanides");
  const actinides = layout.filter(({ position }) => position.section === "actinides");

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || currentElementId === undefined) return;

    const cell = [...container.querySelectorAll<HTMLElement>("[data-element-id]")].find(
      (candidate) => candidate.dataset.elementId === currentElementId,
    );
    if (cell) revealHorizontally(container, cell);
  }, [currentElementId]);

  const renderCells = (elements: readonly PositionedElement[]) =>
    elements.map(({ element, position }) => (
      <PositionCell
        element={element}
        key={element.id}
        onSelect={onSelect}
        position={position}
        state={stateOf(element.id)}
      />
    ));

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm text-slate-600" id="periodic-grid-help">
        Pro zobrazení celé mřížky na úzké obrazovce posuňte tabulku vodorovně.
      </p>
      <section
        aria-label="Periodická tabulka"
        className="overflow-x-auto pb-3"
        ref={scrollContainerRef}
      >
        <div className="min-w-180">
          <fieldset aria-describedby="periodic-grid-help" className="grid grid-cols-18 gap-1">
            <legend className="sr-only">Slepá periodická tabulka</legend>
            {renderCells(mainElements)}
          </fieldset>
          <PeriodicTableSeries label="Lanthanidy">{renderCells(lanthanides)}</PeriodicTableSeries>
          <PeriodicTableSeries label="Aktinidy">{renderCells(actinides)}</PeriodicTableSeries>
        </div>
      </section>
    </div>
  );
}

function PeriodicTableSeries({
  children,
  label,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
}) {
  return (
    <section aria-label={label} className="mt-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{label}</h3>
      <div className="grid grid-cols-18 gap-1">{children}</div>
    </section>
  );
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
  return `${prefix}${description}`;
}

function cellMark(symbol: string, state: PeriodicTableCellState): string {
  if (state.result === "solved") return symbol;
  if (state.result === "incorrect") return "✗";
  return state.current ? "●" : "?";
}

function cellClassName(state: PeriodicTableCellState): string {
  const emphasis = "border-2 border-slate-950 ring-2 ring-emerald-700/30";
  if (state.result === "solved") {
    return `bg-emerald-100 text-emerald-950 ${state.current ? emphasis : "border border-emerald-300"}`;
  }
  if (state.result === "incorrect") {
    return `bg-rose-50 text-rose-900 ${state.current ? emphasis : "border border-rose-300"}`;
  }
  if (state.current) return `bg-emerald-100 text-slate-950 ${emphasis}`;
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
