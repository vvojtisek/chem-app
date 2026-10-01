"use client";

import { classifyElementCategory, type ElementCategory } from "@inorganic/chemistry";
import type { PreparationProductionRuntimeProduct } from "@inorganic/content/preparation-production";
import type { ElementFlashcardData, ElementGroupData } from "@inorganic/content/runtime";
import { type Ref, useEffect, useId, useMemo, useRef, useState } from "react";

import categoryStyles from "@/components/element-category.module.css";
import { Equation, Formula } from "@/components/formula";
import { GroupMnemonics } from "@/components/group-mnemonics";
import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/class-names";
import { czechCount } from "@/lib/czech-plural";
import { ELEMENT_CATEGORY_LABELS, ELEMENT_CATEGORY_OPTIONS } from "@/lib/element-categories";
import {
  EMPTY_ELEMENT_FILTERS,
  type ElementFilters,
  type ElementGroupFilter,
  filterElements,
} from "@/lib/element-search";

const ELEMENT_FORMS = ["prvek", "prvky", "prvků"] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const;
const HASH_PREFIX = "#prvek-";
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

function elementHash(element: ElementFlashcardData): string {
  return `${HASH_PREFIX}${element.symbol.toLowerCase()}`;
}

function elementFromHash(
  elements: readonly ElementFlashcardData[],
  hash: string,
): ElementFlashcardData | undefined {
  if (!hash.startsWith(HASH_PREFIX)) return undefined;
  const symbol = hash.slice(HASH_PREFIX.length);
  return elements.find((element) => element.symbol.toLowerCase() === symbol);
}

/**
 * The element index of the study section: search and category tabs on top, results grouped by
 * category, and the chosen element's detail beside them (below them on phones). The chosen
 * element is mirrored in the URL hash so a detail can be linked, also offline.
 */
export function ElementBrowser({ elements, groups, production }: ElementBrowserProps) {
  const [filters, setFilters] = useState<ElementFilters>(EMPTY_ELEMENT_FILTERS);
  const [selectedId, setSelectedId] = useState(elements[0]?.id ?? "");
  const detailRef = useRef<HTMLElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
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
  const resultsByCategory = useMemo(() => groupByCategory(results), [results]);
  const categoryCounts = useMemo(
    () => countByCategory(filterElements(elements, { ...filters, category: null })),
    [elements, filters],
  );
  const selected = elements.find((element) => element.id === selectedId) ?? elements[0];
  const filteredGroup =
    typeof filters.group === "number" ? groupsByNumber.get(filters.group) : undefined;
  const hasFilters =
    filters.query !== "" ||
    filters.group !== null ||
    filters.period !== null ||
    filters.category !== null;
  const totalWithoutCategory = [...categoryCounts.values()].reduce((sum, count) => sum + count, 0);

  useEffect(() => {
    function selectFromHash() {
      const element = elementFromHash(elements, window.location.hash);
      if (element) setSelectedId(element.id);
    }
    selectFromHash();
    window.addEventListener("hashchange", selectFromHash);
    return () => window.removeEventListener("hashchange", selectFromHash);
  }, [elements]);

  function select(element: ElementFlashcardData) {
    setSelectedId(element.id);
    window.history.replaceState(null, "", elementHash(element));
    // On phones the detail sits below the results; bring it into view.
    if (window.matchMedia?.("(max-width: 63.99rem)").matches) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      detailRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  function returnToIndex() {
    const tile = selected ? tileRefs.current.get(selected.id) : undefined;
    // Focusing scrolls the tile into view.
    tile?.focus();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="min-w-0">
        <search className="grid gap-3">
          <label className="grid gap-1 text-sm font-semibold text-ink-2" htmlFor={searchId}>
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

          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-ink-2">Kategorie</legend>
            <div className="flex flex-wrap gap-1.5">
              <CategoryTab
                count={totalWithoutCategory}
                label="Vše"
                onSelect={() => setFilters({ ...filters, category: null })}
                pressed={filters.category === null}
              />
              {ELEMENT_CATEGORY_OPTIONS.map((category) => (
                <CategoryTab
                  category={category.id}
                  count={categoryCounts.get(category.id) ?? 0}
                  key={category.id}
                  label={category.label}
                  onSelect={() =>
                    setFilters({
                      ...filters,
                      category: filters.category === category.id ? null : category.id,
                    })
                  }
                  pressed={filters.category === category.id}
                />
              ))}
            </div>
          </fieldset>

          <details
            className="group rounded-xl border border-line bg-surface"
            open={filters.group !== null || filters.period !== null ? true : undefined}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 text-sm font-semibold text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Skupina a perioda
              <span aria-hidden="true" className="text-ink-3 group-open:rotate-180">
                ⌄
              </span>
            </summary>
            <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
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
            </div>
          </details>
        </search>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm text-ink-2">
            Nalezeno: {czechCount(results.length, ELEMENT_FORMS)}
          </p>
          {hasFilters ? (
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
          <section aria-label="Výsledky hledání" className="mt-3 grid gap-5">
            {resultsByCategory.map(([category, categoryElements]) => (
              <CategorySection
                category={category}
                elements={categoryElements}
                key={category}
                onSelect={select}
                selectedId={selected?.id}
                tileRefs={tileRefs.current}
              />
            ))}
          </section>
        )}
      </div>

      {selected ? (
        <ElementDetail
          element={selected}
          group={selected.group === null ? undefined : groupsByNumber.get(selected.group)}
          onReturn={returnToIndex}
          products={production[selected.symbol] ?? []}
          ref={detailRef}
        />
      ) : null}
    </div>
  );
}

function groupByCategory(
  elements: readonly ElementFlashcardData[],
): readonly (readonly [ElementCategory, readonly ElementFlashcardData[]])[] {
  const grouped = new Map<ElementCategory, ElementFlashcardData[]>();
  for (const element of elements) {
    const category = classifyElementCategory(element);
    grouped.set(category, [...(grouped.get(category) ?? []), element]);
  }
  return ELEMENT_CATEGORY_OPTIONS.flatMap(({ id }) => {
    const items = grouped.get(id);
    return items ? [[id, items] as const] : [];
  });
}

function countByCategory(
  elements: readonly ElementFlashcardData[],
): ReadonlyMap<ElementCategory, number> {
  const counts = new Map<ElementCategory, number>();
  for (const element of elements) {
    const category = classifyElementCategory(element);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}

function CategoryTab({
  category,
  label,
  count,
  pressed,
  onSelect,
}: Readonly<{
  category?: ElementCategory;
  label: string;
  count: number;
  pressed: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold",
        pressed
          ? "border-ink bg-ink text-ground"
          : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
      data-element-category={category}
      onClick={onSelect}
      type="button"
    >
      {category ? <span aria-hidden="true" className={categoryStyles.swatch} /> : null}
      {label}{" "}
      <span className={cn("tabular-nums", pressed ? "text-ground" : "text-ink-3")}>{count}</span>
    </button>
  );
}

function CategorySection({
  category,
  elements,
  selectedId,
  onSelect,
  tileRefs,
}: Readonly<{
  category: ElementCategory;
  elements: readonly ElementFlashcardData[];
  selectedId: string | undefined;
  onSelect: (element: ElementFlashcardData) => void;
  tileRefs: Map<string, HTMLButtonElement>;
}>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-element-category={category}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-2" id={headingId}>
        <span aria-hidden="true" className={categoryStyles.swatch} />
        {ELEMENT_CATEGORY_LABELS[category]}{" "}
        <span className="font-normal text-ink-3 tabular-nums">({elements.length})</span>
      </h2>
      <ul className="mt-2 grid list-none grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5 p-0">
        {elements.map((element) => {
          const active = element.id === selectedId;
          return (
            <li key={element.id}>
              <button
                aria-controls="element-detail"
                aria-pressed={active}
                className={cn(
                  "grid min-h-16 w-full content-start gap-0.5 rounded-lg border p-1.5 text-left",
                  categoryStyles.tile,
                  active && "ring-2 ring-ink ring-offset-2 ring-offset-ground",
                )}
                onClick={() => onSelect(element)}
                ref={(node) => {
                  if (node) tileRefs.set(element.id, node);
                  else tileRefs.delete(element.id);
                }}
                type="button"
              >
                <span className="text-[0.7rem] leading-none tabular-nums">
                  {element.atomicNumber}
                </span>
                <span className="font-display text-xl leading-none font-bold">
                  {element.symbol}
                </span>
                <span className="truncate text-[0.7rem] font-semibold">{element.nameCs}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ElementDetail({
  element,
  group,
  products,
  onReturn,
  ref,
}: Readonly<{
  element: ElementFlashcardData;
  group: ElementGroupData | undefined;
  products: readonly PreparationProductionRuntimeProduct[];
  onReturn: () => void;
  ref: Ref<HTMLElement>;
}>) {
  const category = classifyElementCategory(element);
  return (
    <section
      aria-labelledby="element-detail-heading"
      className={cn(
        "scroll-mt-20 rounded-2xl border p-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto",
        categoryStyles.panel,
      )}
      data-element-category={category}
      id="element-detail"
      ref={ref}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-16 w-16 shrink-0 place-items-center rounded-xl font-display text-3xl font-bold",
            categoryStyles.badge,
          )}
        >
          {element.symbol}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-ink" id="element-detail-heading">
            {element.nameCs} <span className="sr-only">({element.symbol})</span>
          </h2>
          <p className="text-sm text-ink-2">{element.nameLat}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2">
            <span aria-hidden="true" className={categoryStyles.swatch} />
            <span>
              <span className="sr-only">Kategorie: </span>
              {ELEMENT_CATEGORY_LABELS[category]}
            </span>
          </p>
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
      <button
        className="mt-4 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink lg:hidden"
        onClick={onReturn}
        type="button"
      >
        Zpět na přehled prvků
      </button>
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
