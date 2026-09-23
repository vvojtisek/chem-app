"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useMemo } from "react";

import { PeriodicTableFrame } from "@/components/periodic-table-grid";
import type { PositionedPeriodicTableElement } from "@/lib/periodic-table-layout";
import {
  listSelectionOptions,
  type SelectionCoverage,
  selectionCoverage,
  toggleSelection,
} from "@/lib/periodic-table-scope";

interface PeriodicTableSelectionMatrixProps {
  readonly layout: readonly PositionedPeriodicTableElement<ElementFlashcardData>[];
  readonly selection: ReadonlySet<string>;
  readonly onChange: (selection: ReadonlySet<string>) => void;
}

const PRESSED: Readonly<Record<SelectionCoverage, "true" | "mixed" | "false">> = {
  all: "true",
  some: "mixed",
  none: "false",
};

const SELECTED_STYLE = "border-2 border-sky-700 bg-sky-50 text-slate-950";
const UNSELECTED_STYLE =
  "border border-dashed border-slate-400 bg-slate-50 text-slate-950 opacity-60 grayscale";

// Group headers and row toggles are pills in green (selected), amber (partly) or red (not
// selected), deliberately unlike the element cells; the border style and the struck-through
// label repeat the state for anyone who cannot tell the colors apart.
const TOGGLE_STYLE: Readonly<Record<SelectionCoverage, string>> = {
  all: "border-2 border-emerald-700 bg-emerald-100 text-emerald-900",
  some: "border-2 border-dotted border-amber-600 bg-amber-50 text-amber-950",
  none: "border-2 border-dashed border-rose-600 bg-rose-100 text-rose-800 line-through",
};

export function PeriodicTableSelectionMatrix({
  layout,
  selection,
  onChange,
}: PeriodicTableSelectionMatrixProps) {
  const options = useMemo(() => listSelectionOptions(layout), [layout]);
  const columnMembers = useMemo(
    () => new Map(options.columns.map(({ group, elementIds }) => [group, elementIds])),
    [options],
  );

  return (
    <PeriodicTableFrame
      columnHeader={(group) => {
        const elementIds = columnMembers.get(group) ?? [];
        const coverage = selectionCoverage(selection, elementIds);
        return (
          <button
            aria-label={`Skupina ${group}`}
            aria-pressed={PRESSED[coverage]}
            className={`min-h-11 w-full rounded-full text-sm font-bold ${TOGGLE_STYLE[coverage]}`}
            onClick={() => onChange(toggleSelection(selection, elementIds))}
            type="button"
          >
            {group}
          </button>
        );
      }}
      layout={layout}
      legend="Prvky vybrané k procvičování"
      renderCell={({ element, position }) => {
        const selected = selection.has(element.id);
        return (
          <button
            aria-label={`${element.nameCs} (${element.symbol})`}
            aria-pressed={selected}
            className={`min-h-11 rounded-md text-sm font-semibold ${
              selected ? SELECTED_STYLE : UNSELECTED_STYLE
            }`}
            data-element-id={element.id}
            onClick={() => onChange(toggleSelection(selection, [element.id]))}
            style={{
              gridColumn: position.column,
              gridRow: position.section === "main" ? position.row : 1,
            }}
            type="button"
          >
            {element.symbol}
          </button>
        );
      }}
      seriesHeading={(section, label) => {
        const row = options.rows.find((option) => option.row === section);
        if (!row) return null;
        const coverage = selectionCoverage(selection, row.elementIds);
        return (
          <h3 className="mb-2">
            <button
              aria-pressed={PRESSED[coverage]}
              className={`min-h-11 rounded-full px-4 text-sm font-bold ${TOGGLE_STYLE[coverage]}`}
              onClick={() => onChange(toggleSelection(selection, row.elementIds))}
              type="button"
            >
              {label} ({row.firstSymbol}–{row.lastSymbol})
            </button>
          </h3>
        );
      }}
    />
  );
}
