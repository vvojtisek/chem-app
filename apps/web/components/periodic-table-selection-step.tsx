"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useCallback, useEffect, useState } from "react";

import { PeriodicTableSelectionMatrix } from "@/components/periodic-table-selection-matrix";
import type { PositionedPeriodicTableElement } from "@/lib/periodic-table-layout";
import { loadElementSelection, saveElementSelection } from "@/lib/periodic-table-preferences";
import { defaultSelection, selectElements } from "@/lib/periodic-table-scope";

type Layout = readonly PositionedPeriodicTableElement<ElementFlashcardData>[];

/**
 * The element selection shared by every periodic-table exercise: restored from the browser
 * after mount (the prerendered page starts with the default) and saved on every change.
 */
export function useSharedElementSelection(
  layout: Layout,
  readOnly = false,
): readonly [ReadonlySet<string>, (selection: ReadonlySet<string>) => void] {
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => defaultSelection(layout));

  useEffect(() => {
    if (readOnly) return;
    const stored = loadElementSelection(new Set(layout.map(({ element }) => element.id)));
    if (stored) setSelection(stored);
  }, [layout, readOnly]);

  const changeSelection = useCallback(
    (next: ReadonlySet<string>) => {
      setSelection(next);
      if (!readOnly) saveElementSelection(next);
    },
    [readOnly],
  );

  return [selection, changeSelection];
}

interface PeriodicTableSelectionStepProps {
  readonly layout: Layout;
  readonly selection: ReadonlySet<string>;
  readonly onChange: (selection: ReadonlySet<string>) => void;
  readonly onStart: () => void;
}

export function PeriodicTableSelectionStep({
  layout,
  selection,
  onChange,
  onStart,
}: PeriodicTableSelectionStepProps) {
  const selectedCount = selectElements(layout, selection).length;

  return (
    <section
      aria-labelledby="periodic-table-selection"
      className="rounded-3xl border border-line bg-surface p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="periodic-table-selection" className="text-2xl font-semibold text-ink">
          Výběr prvků
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="min-h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink"
            onClick={() => onChange(new Set(layout.map(({ element }) => element.id)))}
            type="button"
          >
            Vybrat vše
          </button>
          <button
            className="min-h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink"
            onClick={() => onChange(new Set())}
            type="button"
          >
            Zrušit výběr
          </button>
        </div>
      </div>
      <PeriodicTableSelectionMatrix layout={layout} onChange={onChange} selection={selection} />
      <button
        className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-on-fill disabled:cursor-not-allowed disabled:bg-ink-3"
        disabled={selectedCount === 0}
        onClick={onStart}
        type="button"
      >
        Přejít na cvičení ({czechCount(selectedCount, ELEMENT_FORMS)})
      </button>
      {selectedCount === 0 ? (
        <p className="mt-2 text-sm text-ink-2">Vyberte alespoň jeden prvek.</p>
      ) : null}
    </section>
  );
}

const ELEMENT_FORMS = ["prvek", "prvky", "prvků"] as const;

function czechCount(count: number, forms: readonly [string, string, string]): string {
  if (count === 1) return `${count} ${forms[0]}`;
  if (count >= 2 && count <= 4) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}
