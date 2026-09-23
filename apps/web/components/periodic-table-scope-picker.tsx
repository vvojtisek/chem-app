"use client";

import type {
  PeriodicTableRow,
  PeriodicTableScope,
  PeriodicTableScopeOptions,
} from "@/lib/periodic-table-scope";

interface PeriodicTableScopePickerProps {
  readonly options: PeriodicTableScopeOptions;
  readonly groupNames: ReadonlyMap<number, string>;
  readonly scope: PeriodicTableScope;
  readonly onChange: (scope: PeriodicTableScope) => void;
}

const ROW_LABELS: Readonly<Record<PeriodicTableRow, string>> = {
  lanthanides: "Lanthanidy",
  actinides: "Aktinidy",
};

export function PeriodicTableScopePicker({
  options,
  groupNames,
  scope,
  onChange,
}: PeriodicTableScopePickerProps) {
  const selectedGroups = new Set(scope.groups);
  const selectedRows = new Set(scope.rows);

  function toggleGroup(group: number, checked: boolean) {
    onChange({
      ...scope,
      groups: options.groups
        .map((option) => option.group)
        .filter((candidate) => (candidate === group ? checked : selectedGroups.has(candidate))),
    });
  }

  function toggleRow(row: PeriodicTableRow, checked: boolean) {
    onChange({
      ...scope,
      rows: options.rows
        .map((option) => option.row)
        .filter((candidate) => (candidate === row ? checked : selectedRows.has(candidate))),
    });
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-3">
        <button
          className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900"
          onClick={() =>
            onChange({
              groups: options.groups.map(({ group }) => group),
              rows: options.rows.map(({ row }) => row),
            })
          }
          type="button"
        >
          Vybrat vše
        </button>
        <button
          className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900"
          onClick={() => onChange({ groups: [], rows: [] })}
          type="button"
        >
          Zrušit výběr
        </button>
      </div>

      <fieldset>
        <legend className="font-semibold text-slate-950">Skupiny periodické tabulky</legend>
        <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {options.groups.map(({ group, count }) => {
            const name = groupNames.get(group);
            return (
              <label className="flex min-h-11 items-start gap-2 py-2" key={group}>
                <input
                  checked={selectedGroups.has(group)}
                  className="mt-1 size-4"
                  onChange={(event) => toggleGroup(group, event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="font-medium text-slate-900">
                    {group}. skupina ({count})
                  </span>
                  {name ? <span className="block text-sm text-slate-600">{name}</span> : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold text-slate-950">Spodní řady (f-blok)</legend>
        <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {options.rows.map(({ row, count, firstSymbol, lastSymbol }) => (
            <label className="flex min-h-11 items-center gap-2 py-2" key={row}>
              <input
                checked={selectedRows.has(row)}
                className="size-4"
                onChange={(event) => toggleRow(row, event.target.checked)}
                type="checkbox"
              />
              <span className="font-medium text-slate-900">
                {ROW_LABELS[row]}: spodní řada {firstSymbol}–{lastSymbol} ({count})
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
