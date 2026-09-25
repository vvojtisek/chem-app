"use client";

import type { NomenclatureRuntimeRecord } from "@inorganic/content/nomenclature-schema";
import { useId, useMemo } from "react";

import {
  type ElementCountFilter,
  filterCompounds,
  listQuickFamilies,
  matchesElementCount,
  NOMENCLATURE_CATEGORIES,
  type NomenclatureCategory,
  type NomenclatureFilters,
} from "@/lib/nomenclature-session";

export const CATEGORY_LABELS: Readonly<Record<NomenclatureCategory, string>> = {
  "element-ion": "Prvky a jednoduché ionty",
  oxide: "Oxidy",
  hydride: "Hydridy",
  "binary-acid": "Bezkyslíkaté kyseliny",
  oxoacid: "Kyslíkaté kyseliny",
  hydroxide: "Hydroxidy",
  "binary-salt": "Soli bezkyslíkatých kyselin",
  "oxoacid-salt": "Soli kyslíkatých kyselin",
  coordination: "Koordinační / komplexní sloučeniny",
  other: "Další",
};

const QUICK_FAMILY_CATEGORIES: ReadonlySet<NomenclatureCategory> = new Set([
  "binary-salt",
  "oxoacid-salt",
]);

const ELEMENT_COUNT_OPTIONS: readonly {
  readonly value: ElementCountFilter;
  readonly label: string;
}[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4+", label: "4 a více" },
  { value: "all", label: "Všechny" },
];

const PILL =
  "inline-flex min-h-11 items-center gap-1 rounded-full border-2 px-4 text-sm font-semibold";
const PILL_ON = "border-good bg-good-soft text-good";
const PILL_OFF = "border-line-strong bg-surface text-ink-2";

interface NomenclatureFilterStepProps {
  readonly compounds: readonly NomenclatureRuntimeRecord[];
  readonly filters: NomenclatureFilters;
  readonly onChange: (filters: NomenclatureFilters) => void;
  readonly onStart: () => void;
}

export function NomenclatureFilterStep({
  compounds,
  filters,
  onChange,
  onStart,
}: NomenclatureFilterStepProps) {
  const headingId = useId();
  const countGroupName = useId();
  const selected = new Set(filters.categories);
  const selectedFamilies = new Set(filters.families);
  const available = NOMENCLATURE_CATEGORIES.filter((category) =>
    compounds.some((record) => record.category === category),
  );
  const matching = filterCompounds(compounds, filters).length;
  const quickFamilies = useMemo(
    () =>
      new Map(
        [...QUICK_FAMILY_CATEGORIES].map((category) => [
          category,
          listQuickFamilies(compounds, category),
        ]),
      ),
    [compounds],
  );

  function toggleCategory(category: NomenclatureCategory) {
    const categories = selected.has(category)
      ? filters.categories.filter((candidate) => candidate !== category)
      : available.filter((candidate) => candidate === category || selected.has(candidate));
    onChange({
      ...filters,
      categories,
      families: filters.families.filter((family) => family.split(":")[0] !== category),
    });
  }

  function toggleFamily(key: string) {
    onChange({
      ...filters,
      families: selectedFamilies.has(key)
        ? filters.families.filter((family) => family !== key)
        : [...filters.families, key],
    });
  }

  return (
    <section aria-labelledby={headingId} className="rounded-3xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-ink" id={headingId}>
          Výběr látek
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="min-h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink"
            onClick={() => onChange({ ...filters, categories: [...available], families: [] })}
            type="button"
          >
            Vybrat vše
          </button>
          <button
            className="min-h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink"
            onClick={() => onChange({ ...filters, categories: [], families: [] })}
            type="button"
          >
            Zrušit výběr
          </button>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="font-semibold text-ink">Kategorie</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {available.map((category) => {
            const on = selected.has(category);
            const count = compounds.filter(
              (record) =>
                record.category === category && matchesElementCount(record, filters.elementCount),
            ).length;
            return (
              <button
                aria-pressed={on}
                className={`${PILL} ${on ? PILL_ON : PILL_OFF}`}
                key={category}
                onClick={() => toggleCategory(category)}
                type="button"
              >
                {on ? <span aria-hidden="true">✓</span> : null}
                {CATEGORY_LABELS[category]}
                <span className="font-normal text-ink-2">({count})</span>
              </button>
            );
          })}
        </div>
        {[...quickFamilies].map(([category, families]) =>
          selected.has(category) && families.length > 0 ? (
            <fieldset className="mt-4" key={category}>
              <legend className="text-sm font-medium text-ink-2">
                Rychlý výběr – {CATEGORY_LABELS[category].toLowerCase()}
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {families.map(({ key, family, count }) => {
                  const on = selectedFamilies.has(key);
                  return (
                    <button
                      aria-pressed={on}
                      className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-sm font-medium ${
                        on ? PILL_ON : PILL_OFF
                      }`}
                      key={key}
                      onClick={() => toggleFamily(key)}
                      type="button"
                    >
                      {on ? <span aria-hidden="true">✓</span> : null}
                      {familyLabel(family)}
                      <span className="text-ink-2">({count})</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null,
        )}
      </fieldset>

      <fieldset className="mt-6">
        <legend className="font-semibold text-ink">Počet prvků ve sloučenině</legend>
        <div className="mt-3 inline-flex flex-wrap rounded-xl border border-line-strong bg-surface-3 p-1">
          {ELEMENT_COUNT_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                checked={filters.elementCount === option.value}
                className="peer sr-only"
                name={countGroupName}
                onChange={() => onChange({ ...filters, elementCount: option.value })}
                type="radio"
                value={option.value}
              />
              <span className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-4 text-sm font-semibold text-ink-2 peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                {filters.elementCount === option.value ? <span aria-hidden="true">✓</span> : null}
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        className="mt-6 min-h-11 rounded-xl bg-accent px-5 font-semibold text-on-fill disabled:cursor-not-allowed disabled:bg-ink-3"
        disabled={matching === 0}
        onClick={onStart}
        type="button"
      >
        Spustit cvičení ({czechCount(matching)})
      </button>
      {matching === 0 ? (
        <p className="mt-2 text-sm text-warn" role="status">
          Této kombinaci filtrů neodpovídá žádná látka. Upravte kategorie nebo počet prvků.
        </p>
      ) : null}
    </section>
  );
}

function familyLabel(family: string): string {
  const plural = `${family}y`;
  return plural.charAt(0).toLocaleUpperCase("cs-CZ") + plural.slice(1);
}

export function czechCount(count: number): string {
  if (count === 1) return `${count} sloučenina`;
  if (count >= 2 && count <= 4) return `${count} sloučeniny`;
  return `${count} sloučenin`;
}
