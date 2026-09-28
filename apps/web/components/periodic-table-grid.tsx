"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { Fragment, type ReactNode } from "react";

import { WRONG_MARK_DURATION_MS } from "@/components/use-wrong-marks";
import styles from "@/components/periodic-practice.module.css";
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
  readonly appearance?: "practice" | undefined;
  readonly onSelect?: ((position: PeriodicTablePosition) => void) | undefined;
  readonly cellResult?: ((elementId: string) => PeriodicTableCellResult | null) | undefined;
  /** Seconds until a wrong mark clears, shown as a small countdown beside the ✗. */
  readonly secondsLeft?: ((elementId: string) => number | null) | undefined;
}

const WRONG_MARK_SECONDS = WRONG_MARK_DURATION_MS / 1000;

const SERIES_LABELS: Readonly<Record<PeriodicTableSeriesSection, string>> = {
  lanthanides: "Lanthanidy",
  actinides: "Aktinidy",
};

/**
 * The blind table used during exercises. Every unanswered cell looks the same („?“) so the
 * table never hints where the sought element is; only answered cells differ.
 */
export function PeriodicTableGrid({
  layout,
  appearance,
  onSelect,
  cellResult,
  secondsLeft,
}: PeriodicTableGridProps) {
  return (
    <PeriodicTableFrame
      appearance={appearance}
      layout={layout}
      legend="Slepá periodická tabulka"
      renderCell={({ element, position }) => (
        <PositionCell
          appearance={appearance}
          element={element}
          onSelect={onSelect}
          position={position}
          result={cellResult?.(element.id) ?? null}
          secondsLeft={secondsLeft?.(element.id) ?? null}
        />
      )}
    />
  );
}

/** Explains the three cell states of the blind table; it never reveals the sought element. */
export function PeriodicTableLegend({
  className = "",
}: Readonly<{ className?: string | undefined }>) {
  return (
    <ul
      aria-label="Legenda tabulky"
      className={`mt-1 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm text-ink-2 ${className}`}
    >
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`grid h-7 w-8 place-items-center rounded-md text-xs font-semibold ${CELL_STYLES.solved}`}
        >
          Fe
        </span>
        zodpovězeno
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`grid h-7 w-8 place-items-center rounded-md text-xs font-semibold ${CELL_STYLES.incorrect}`}
        >
          ✗
        </span>
        chyba, políčko se za {WRONG_MARK_SECONDS} s vrátí na „?“
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`grid h-7 w-8 place-items-center rounded-md text-xs font-semibold ${CELL_STYLES.blank}`}
        >
          ?
        </span>
        zatím bez odpovědi
      </li>
    </ul>
  );
}

export type PeriodicTableSeriesSection = Exclude<PeriodicTableSection, "main">;

interface PeriodicTableFrameProps {
  readonly layout: readonly PositionedElement[];
  readonly appearance?: "practice" | "selection" | undefined;
  readonly legend: string;
  readonly renderCell: (positioned: PositionedElement) => ReactNode;
  readonly columnHeader?: ((group: number) => ReactNode) | undefined;
  readonly seriesHeading?:
    | ((section: PeriodicTableSeriesSection, label: string) => ReactNode)
    | undefined;
}

export function PeriodicTableFrame({
  layout,
  appearance,
  legend,
  renderCell,
  columnHeader,
  seriesHeading = defaultSeriesHeading,
}: PeriodicTableFrameProps) {
  const mainElements = layout.filter(({ position }) => position.section === "main");
  const columns = [...new Set(mainElements.map(({ position }) => position.column))].sort(
    (left, right) => left - right,
  );
  const frameAppearanceClass =
    appearance === "selection"
      ? styles.selectionTable
      : appearance === "practice"
        ? styles.practiceTable
        : "mt-6";
  const frameClassName = `${styles.frame} ${frameAppearanceClass}`;
  const renderCells = (elements: readonly PositionedElement[]) =>
    elements.map((positioned) => (
      <Fragment key={positioned.element.id}>{renderCell(positioned)}</Fragment>
    ));

  return (
    <div className={frameClassName}>
      {/* Keyboard focus lets Safari users scroll the table when its cells are not interactive. */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: A scrollable region needs keyboard access even without enabled cells. */}
      <section
        aria-label="Periodická tabulka"
        className={`${styles.tableScroll} pb-3`}
        tabIndex={0}
      >
        <div className={styles.tableCanvas}>
          {columnHeader ? (
            <div
              className={`${styles.columnHeaderGrid} mb-3 grid grid-cols-18 gap-1 border-b border-line-strong pb-3`}
            >
              {columns.map((column) => (
                <div key={column} style={{ gridColumn: column }}>
                  {columnHeader(column)}
                </div>
              ))}
            </div>
          ) : null}
          <fieldset className={`grid grid-cols-18 gap-1 ${styles.periodicGrid}`}>
            <legend className="sr-only">{legend}</legend>
            {renderCells(mainElements)}
          </fieldset>
          {(["lanthanides", "actinides"] as const).map((section) => (
            <section aria-label={SERIES_LABELS[section]} className="mt-3" key={section}>
              {seriesHeading(section, SERIES_LABELS[section])}
              <div className={`grid grid-cols-18 gap-1 ${styles.periodicGrid}`}>
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
  return (
    <h3 className={`${styles.seriesHeading} mb-2 text-sm font-semibold text-ink-2`}>{label}</h3>
  );
}

function PositionCell({
  appearance,
  element,
  onSelect,
  position,
  result,
  secondsLeft,
}: {
  readonly appearance: "practice" | undefined;
  readonly element: ElementFlashcardData;
  readonly onSelect: ((position: PeriodicTablePosition) => void) | undefined;
  readonly position: PeriodicTablePosition;
  readonly result: PeriodicTableCellResult | null;
  readonly secondsLeft: number | null;
}) {
  const cellClassName =
    appearance === "practice"
      ? styles.practiceCell
      : `min-h-11 rounded-md text-sm font-semibold ${CELL_STYLES[result ?? "blank"]}`;

  return (
    <button
      aria-label={cellLabel(describePeriodicTablePosition(position), element.symbol, result)}
      className={cellClassName}
      data-cell-result={result ?? undefined}
      data-result={appearance === "practice" ? (result ?? "blank") : undefined}
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
      {result === "incorrect" && secondsLeft !== null ? (
        <span aria-hidden="true" className="ml-0.5 align-top text-[10px] font-medium tabular-nums">
          {secondsLeft}
        </span>
      ) : null}
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
