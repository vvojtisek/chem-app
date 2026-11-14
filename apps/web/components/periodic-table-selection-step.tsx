"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useCallback, useEffect, useState } from "react";
import styles from "@/components/periodic-practice.module.css";
import { PeriodicTableSelectionMatrix } from "@/components/periodic-table-selection-matrix";
import { RoundLengthChoice } from "@/components/round-length-choice";
import { SetupStartBar } from "@/components/setup-start-bar";
import type { PositionedPeriodicTableElement } from "@/lib/periodic-table-layout";
import { loadElementSelection, saveElementSelection } from "@/lib/periodic-table-preferences";
import { defaultSelection, selectElements } from "@/lib/periodic-table-scope";
import { plannedRoundSize, type RoundLength } from "@/lib/round-length";

type Layout = readonly PositionedPeriodicTableElement<ElementFlashcardData>[];

/**
 * The element selection shared by every periodic-table exercise: restored from the browser
 * after mount (the prerendered page starts with the default) and saved on every change.
 */
export function useSharedElementSelection(
  layout: Layout,
  readOnly = false,
): readonly [ReadonlySet<string>, (selection: ReadonlySet<string>) => void, boolean] {
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => defaultSelection(layout));
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (readOnly) return;
    const stored = loadElementSelection(new Set(layout.map(({ element }) => element.id)));
    if (stored) {
      setSelection(stored);
      setRestored(true);
    }
  }, [layout, readOnly]);

  const changeSelection = useCallback(
    (next: ReadonlySet<string>) => {
      setSelection(next);
      if (!readOnly) saveElementSelection(next);
    },
    [readOnly],
  );

  return [selection, changeSelection, restored];
}

interface PeriodicTableSelectionStepProps {
  readonly layout: Layout;
  readonly selection: ReadonlySet<string>;
  readonly onChange: (selection: ReadonlySet<string>) => void;
  readonly onStart: () => void;
  /** A selection saved on an earlier visit: the matrix starts collapsed to a summary line. */
  readonly restored?: boolean;
  readonly roundLength?: RoundLength;
  readonly onRoundLengthChange?: (length: RoundLength) => void;
}

export function PeriodicTableSelectionStep({
  layout,
  selection,
  onChange,
  onStart,
  restored = false,
  roundLength,
  onRoundLengthChange,
}: PeriodicTableSelectionStepProps) {
  const [expanded, setExpanded] = useState(false);
  const selectedCount = selectElements(layout, selection).length;
  const collapsed = restored && !expanded && selectedCount > 0;
  const planned =
    roundLength === undefined ? selectedCount : plannedRoundSize(selectedCount, roundLength);

  return (
    <section aria-labelledby="periodic-table-selection" className={styles.selection}>
      <div className={styles.selectionHeader}>
        <h2 id="periodic-table-selection" className={styles.selectionTitle}>
          Výběr prvků
        </h2>
        <div className={styles.selectionActions}>
          {collapsed ? (
            <button
              className={styles.selectionButton}
              onClick={() => setExpanded(true)}
              type="button"
            >
              Změnit výběr
            </button>
          ) : (
            <>
              <button
                className={styles.selectionButton}
                onClick={() => onChange(new Set(layout.map(({ element }) => element.id)))}
                type="button"
              >
                Vybrat vše
              </button>
              <button
                className={styles.selectionButton}
                onClick={() => onChange(new Set())}
                type="button"
              >
                Zrušit výběr
              </button>
            </>
          )}
        </div>
      </div>
      {collapsed ? (
        <p className="m-0 text-ink-2" data-selection-summary="">
          Vybráno {czechCount(selectedCount, ELEMENT_FORMS)} z {layout.length}, stejně jako minule.
        </p>
      ) : (
        <PeriodicTableSelectionMatrix layout={layout} onChange={onChange} selection={selection} />
      )}
      {roundLength !== undefined && onRoundLengthChange ? (
        <RoundLengthChoice
          available={selectedCount}
          onChange={onRoundLengthChange}
          value={roundLength}
        />
      ) : null}
      <SetupStartBar summary={selectedCount === 0 ? "Vyberte alespoň jeden prvek." : undefined}>
        <button
          className={styles.startButton}
          disabled={selectedCount === 0}
          onClick={onStart}
          type="button"
        >
          Přejít na cvičení (
          {planned < selectedCount
            ? `${planned} z ${czechCount(selectedCount, ELEMENT_FORMS)}`
            : czechCount(selectedCount, ELEMENT_FORMS)}
          )
        </button>
      </SetupStartBar>
    </section>
  );
}

const ELEMENT_FORMS = ["prvek", "prvky", "prvků"] as const;

function czechCount(count: number, forms: readonly [string, string, string]): string {
  if (count === 1) return `${count} ${forms[0]}`;
  if (count >= 2 && count <= 4) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}
