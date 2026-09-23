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

const TOGGLE_STYLE: Readonly<Record<SelectionCoverage, string>> = {
  all: SELECTED_STYLE,
  some: "border-2 border-dashed border-sky-700 bg-white text-slate-950",
  none: UNSELECTED_STYLE,
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
            className={`min-h-11 w-full rounded-md text-sm font-semibold ${TOGGLE_STYLE[coverage]}`}
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
              className={`min-h-11 rounded-md px-3 text-sm font-semibold ${TOGGLE_STYLE[coverage]}`}
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
