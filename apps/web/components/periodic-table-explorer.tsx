"use client";

import { classifyElementCategory } from "@inorganic/chemistry";
import type { ElementFlashcardData, ElementGroupData } from "@inorganic/content/runtime";
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import categoryStyles from "@/components/element-category.module.css";
import styles from "@/components/periodic-table-explorer.module.css";
import { PeriodicTableFrame } from "@/components/periodic-table-grid";
import { cn } from "@/lib/class-names";
import { ELEMENT_CATEGORY_OPTIONS } from "@/lib/element-categories";
import {
  createPeriodicTableLayout,
  describePeriodicTablePosition,
} from "@/lib/periodic-table-layout";

const atomicWeightFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 6 });

interface PeriodicTableExplorerProps {
  readonly elements: readonly ElementFlashcardData[];
  readonly groups: readonly ElementGroupData[];
}

export function PeriodicTableExplorer({ elements, groups }: PeriodicTableExplorerProps) {
  const layout = useMemo(() => createPeriodicTableLayout(elements), [elements]);
  const groupsByNumber = useMemo(
    () => new Map(groups.map((group) => [group.groupNumber, group])),
    [groups],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const selected = elements.find((element) => element.id === selectedId) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (selected && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
      return;
    }

    if (!selected && dialog.open) dialog.close();
    if (!selected) openerRef.current?.focus();
  }, [selected]);

  if (elements.length === 0) {
    return <p role="status">K dispozici nejsou žádné prvky k prozkoumání.</p>;
  }

  return (
    <>
      <p className="mb-3 text-sm text-ink-2">
        Tabulka má 18 skupin a 7 period. Na menších obrazovkách ji posuňte vodorovně.
      </p>
      <ul aria-label="Legenda skupin prvků" className={styles.key}>
        {ELEMENT_CATEGORY_OPTIONS.map((category) => (
          <li className={styles.keyItem} key={category.id}>
            <span
              aria-hidden="true"
              className={categoryStyles.swatch}
              data-element-category={category.id}
            />
            {category.label}
          </li>
        ))}
      </ul>
      <PeriodicTableFrame
        layout={layout}
        legend="Slepá periodická tabulka pro prozkoumání prvků"
        renderCell={({ element, position }) => (
          <button
            aria-label={`${element.atomicNumber}. protonové číslo; ${describePeriodicTablePosition(position)}`}
            className={cn(
              "grid min-h-11 min-w-11 place-items-center rounded-md border font-mono text-xs font-semibold transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-sm",
              categoryStyles.tile,
            )}
            data-element-category={classifyElementCategory(element)}
            key={element.id}
            onClick={(event) => {
              openerRef.current = event.currentTarget;
              setSelectedId(element.id);
            }}
            style={{
              gridColumn: position.column,
              gridRow: position.section === "main" ? position.row : 1,
            }}
            type="button"
          >
            {element.atomicNumber}
          </button>
        )}
        seriesHeading={(_section, label) => (
          <h2 className="mb-2 text-sm font-semibold text-ink-2">{label}</h2>
        )}
      />

      <dialog
        aria-labelledby="periodic-table-element-heading"
        className={cn(
          "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border p-0 text-ink shadow-2xl backdrop:bg-black/60",
          categoryStyles.panel,
          styles.modal,
        )}
        data-element-category={selected ? classifyElementCategory(selected) : undefined}
        onCancel={(event) => {
          event.preventDefault();
          setSelectedId(null);
        }}
        onClose={() => {
          setSelectedId(null);
          openerRef.current?.focus();
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setSelectedId(null);
        }}
        ref={dialogRef}
      >
        {selected ? (
          <article className="p-5 sm:p-6">
            <header className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-16 w-16 shrink-0 place-items-center rounded-xl font-display text-3xl font-bold",
                  categoryStyles.badge,
                )}
              >
                {selected.symbol}
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  className="font-display text-2xl font-bold text-ink"
                  id="periodic-table-element-heading"
                >
                  {selected.nameCs} ({selected.symbol})
                </h2>
                <p className="mt-1 text-sm text-ink-2">{selected.nameLat}</p>
              </div>
              <button
                aria-label="Zavřít údaje o prvku"
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  categoryStyles.button,
                )}
                onClick={() => setSelectedId(null)}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </header>

            <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fact label="Značka / Symbol" value={selected.symbol} />
              <Fact label="Název (CZ)" value={selected.nameCs} />
              <Fact label="Latinský název" value={selected.nameLat} />
              <Fact label="Protonové číslo (Z)" value={String(selected.atomicNumber)} />
              <Fact
                label="Relativní atomová hmotnost"
                value={atomicWeightFormatter.format(selected.atomicWeight)}
              />
              <Fact
                label="Skupina"
                value={groupLabel(
                  selected,
                  selected.group === null ? undefined : groupsByNumber.get(selected.group),
                )}
              />
              <div className={cn("rounded-xl border p-3 sm:col-span-2", categoryStyles.fact)}>
                <dt className="text-sm text-ink-2">Valenční elektronová konfigurace</dt>
                <dd className="mt-1 font-mono text-lg font-medium text-ink">
                  <FormattedConfiguration value={selected.valenceConfiguration} />
                </dd>
              </div>
            </dl>
          </article>
        ) : null}
      </dialog>
    </>
  );
}

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className={cn("rounded-xl border p-3", categoryStyles.fact)}>
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}

function groupLabel(element: ElementFlashcardData, group: ElementGroupData | undefined): string {
  if (element.group === null) {
    return element.period === 6 ? "f-blok – Lanthanoidy" : "f-blok – Aktinoidy";
  }
  return group ? `${element.group}. skupina – ${group.nameCs}` : `${element.group}. skupina`;
}

function FormattedConfiguration({ value }: Readonly<{ value: string }>) {
  const formatted: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(/([spdf])(\d+)/gu)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) formatted.push(value.slice(lastIndex, matchIndex));
    formatted.push(
      <Fragment key={match[0]}>
        {match[1]}
        <sup>{match[2]}</sup>
      </Fragment>,
    );
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < value.length) formatted.push(value.slice(lastIndex));
  return (
    <span>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">{formatted}</span>
    </span>
  );
}
