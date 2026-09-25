"use client";

import type { PreparationProductionRuntimeProduct } from "@inorganic/content/preparation-production";
import type { ElementFlashcardData, ElementGroupData } from "@inorganic/content/runtime";
import { type Ref, useId, useMemo, useRef, useState } from "react";

import { Equation, Formula } from "@/components/formula";
import { GroupMnemonics } from "@/components/group-mnemonics";
import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/class-names";
import { czechCount } from "@/lib/czech-plural";
import {
  EMPTY_ELEMENT_FILTERS,
  type ElementFilters,
  type ElementGroupFilter,
  filterElements,
} from "@/lib/element-search";

const ELEMENT_FORMS = ["prvek", "prvky", "prvků"] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const;
const numberFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 6 });

interface ElementBrowserProps {
  readonly elements: readonly ElementFlashcardData[];
  readonly groups: readonly ElementGroupData[];
  /** Preparation and production of the element itself, keyed by element symbol. */
  readonly production: Readonly<Record<string, readonly PreparationProductionRuntimeProduct[]>>;
}

function groupLabel(groupNumber: number, group: ElementGroupData | undefined): string {
  return group ? `${groupNumber}. skupina – ${group.nameCs}` : `${groupNumber}. skupina`;
}

/**
 * Finds one element in one step: search and filters on the left, the chosen element's facts,
 * group mnemonic and production routes on the right (below the results on phones).
 */
export function ElementBrowser({ elements, groups, production }: ElementBrowserProps) {
  const [filters, setFilters] = useState<ElementFilters>(EMPTY_ELEMENT_FILTERS);
  const [selectedId, setSelectedId] = useState(elements[0]?.id ?? "");
  const detailRef = useRef<HTMLElement>(null);
  const searchId = useId();
  const groupsByNumber = useMemo(
    () => new Map(groups.map((group) => [group.groupNumber, group])),
    [groups],
  );
  const groupNumbers = useMemo(
    () =>
      [
        ...new Set(elements.flatMap((element) => (element.group === null ? [] : [element.group]))),
      ].sort((left, right) => left - right),
    [elements],
  );
  const results = useMemo(() => filterElements(elements, filters), [elements, filters]);
  const selected = elements.find((element) => element.id === selectedId) ?? elements[0];
  const filteredGroup =
    typeof filters.group === "number" ? groupsByNumber.get(filters.group) : undefined;

  function select(element: ElementFlashcardData) {
    setSelectedId(element.id);
    // On phones the detail sits below the results; bring it into view.
    if (window.matchMedia?.("(max-width: 63.99rem)").matches) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      detailRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div>
        <search className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <label
            className="grid gap-1 text-sm font-semibold text-ink-2 sm:col-span-2"
            htmlFor={searchId}
          >
            Hledat prvek
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg text-ink-3" />
              <input
                autoComplete="off"
                className="min-h-11 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-10 text-base font-normal text-ink"
                id={searchId}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                placeholder="název, značka nebo protonové číslo"
                spellCheck={false}
                type="search"
                value={filters.query}
              />
            </span>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink-2">
            Skupina
            <select
              className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base font-normal text-ink"
              onChange={(event) => {
                const value = event.target.value;
                const group: ElementGroupFilter =
                  value === "" ? null : value === "f" ? "f" : Number(value);
                setFilters({ ...filters, group });
              }}
              value={filters.group === null ? "" : String(filters.group)}
            >
              <option value="">Všechny skupiny</option>
              {groupNumbers.map((groupNumber) => (
                <option key={groupNumber} value={groupNumber}>
                  {groupLabel(groupNumber, groupsByNumber.get(groupNumber))}
                </option>
              ))}
              <option value="f">f-blok (lanthanoidy a aktinoidy)</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink-2">
            Perioda
            <select
              className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base font-normal text-ink"
              onChange={(event) =>
                setFilters({
                  ...filters,
                  period: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              value={filters.period === null ? "" : String(filters.period)}
            >
              <option value="">Všechny periody</option>
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period}. perioda
                </option>
              ))}
            </select>
          </label>
        </search>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm text-ink-2">
            Nalezeno: {czechCount(results.length, ELEMENT_FORMS)}
          </p>
          {filters.query || filters.group !== null || filters.period !== null ? (
            <button
              className="min-h-10 rounded-lg px-2 text-sm font-semibold text-accent-strong hover:underline"
              onClick={() => setFilters(EMPTY_ELEMENT_FILTERS)}
              type="button"
            >
              Zrušit filtry
            </button>
          ) : null}
        </div>

        {filteredGroup ? (
          <section
            aria-label={`Skupina ${filteredGroup.groupNumber}`}
            className="mt-3 rounded-2xl border border-line bg-surface p-4"
          >
            <h2 className="font-semibold text-ink">
              {groupLabel(filteredGroup.groupNumber, filteredGroup)}
            </h2>
            <GroupMnemonics group={filteredGroup} />
          </section>
        ) : filters.group === "f" ? (
          <p className="mt-3 rounded-2xl border border-line bg-surface p-4 text-sm leading-6 text-ink-2">
            Lanthanoidy a aktinoidy jsou uvedeny samostatně, protože nemají číslo skupiny v hlavní
            části tabulky.
          </p>
        ) : null}

        {results.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line-strong p-5 text-ink-2">
            Žádný prvek neodpovídá hledání. Zkuste jiný název, značku nebo zrušte filtry.
          </p>
        ) : (
          <ul
            aria-label="Výsledky hledání"
            className="mt-3 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4 xl:grid-cols-6"
          >
            {results.map((element) => {
              const active = element.id === selected?.id;
              return (
                <li key={element.id}>
                  <button
                    aria-controls="element-detail"
                    aria-pressed={active}
                    className={cn(
                      "grid min-h-20 w-full content-start gap-0.5 rounded-xl border p-2 text-left",
                      active
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-2",
                    )}
                    onClick={() => select(element)}
                    type="button"
                  >
                    <span className="text-xs text-ink-3 tabular-nums">{element.atomicNumber}</span>
                    <span className="font-display text-2xl leading-none font-bold text-ink">
                      {element.symbol}
                    </span>
                    <span className="truncate text-xs font-semibold text-ink-2">
                      {element.nameCs}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected ? (
        <ElementDetail
          element={selected}
          group={selected.group === null ? undefined : groupsByNumber.get(selected.group)}
          products={production[selected.symbol] ?? []}
          ref={detailRef}
        />
      ) : null}
    </div>
  );
}

function ElementDetail({
  element,
  group,
  products,
  ref,
}: Readonly<{
  element: ElementFlashcardData;
  group: ElementGroupData | undefined;
  products: readonly PreparationProductionRuntimeProduct[];
  ref: Ref<HTMLElement>;
}>) {
  return (
    <section
      aria-labelledby="element-detail-heading"
      className="scroll-mt-20 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
      id="element-detail"
      ref={ref}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-accent font-display text-3xl font-bold text-on-fill"
        >
          {element.symbol}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-ink" id="element-detail-heading">
            {element.nameCs} <span className="sr-only">({element.symbol})</span>
          </h2>
          <p className="text-sm text-ink-2">{element.nameLat}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <StudyFact label="Protonové číslo" value={String(element.atomicNumber)} />
        <StudyFact
          label="Relativní atomová hmotnost"
          value={numberFormatter.format(element.atomicWeight)}
        />
        <StudyFact label="Perioda" value={String(element.period)} />
        <StudyFact
          label="Skupina"
          value={element.group === null ? "f-blok" : groupLabel(element.group, group)}
        />
        <div className="col-span-2">
          <dt className="text-ink-2">Valenční konfigurace</dt>
          <dd className="font-mono font-medium text-ink">{element.valenceConfiguration}</dd>
        </div>
      </dl>
      {group ? (
        <div className="mt-4 border-t border-line pt-4 text-sm">
          <GroupMnemonics group={group} />
        </div>
      ) : null}
      <div className="mt-4 border-t border-line pt-4">
        {products.length === 0 ? (
          <p className="text-sm text-ink-2">
            Příprava ani výroba tohoto prvku v učivu uvedena není.
          </p>
        ) : (
          products.map((product) => (
            <section aria-label={`Příprava a výroba: ${element.nameCs}`} key={product.id}>
              <h3 className="font-semibold text-ink">
                Příprava a výroba: {product.nameCs} (<Formula formula={product.formula} />)
              </h3>
              {product.notes.map((note) => (
                <p className="mt-2 text-sm leading-6 text-ink-2" key={`${note.kind}-${note.text}`}>
                  {note.kind === "preparation" ? "Příprava" : "Výroba"}: {note.text}
                </p>
              ))}
              {product.routes.length > 0 ? (
                <ul className="mt-3 grid list-none gap-2 p-0 text-sm">
                  {product.routes.map((route) => (
                    <li className="rounded-lg bg-surface-2 p-3 leading-6" key={route.id}>
                      <span className="block text-xs font-semibold text-ink-3">
                        {route.kind === "preparation" ? "Příprava" : "Výroba"}
                      </span>
                      <Equation products={route.products} reactants={route.reactants} />
                      {route.conditionsCs ? (
                        <span className="block text-ink-2">
                          Podmínky nad šipkou: {route.conditionsCs}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <a
                className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-accent-strong underline"
                href={product.sources[0]?.locator}
                rel="noreferrer"
                target="_blank"
              >
                Zdroj: e-learning VŠCHT
              </a>
            </section>
          ))
        )}
      </div>
    </section>
  );
}

function StudyFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
