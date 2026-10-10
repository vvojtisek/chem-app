"use client";

import type { NomenclatureRecord } from "@inorganic/content/nomenclature-schema";
import { type FormEvent, useId, useState } from "react";
import { CATEGORY_LABELS } from "@/components/nomenclature-filters";
import {
  editNomenclatureRecord,
  type NomenclatureDraft,
  nomenclatureDraft,
} from "@/lib/nomenclature-editing";

const INPUT = "min-h-11 rounded-xl border bg-surface px-3";
const PRIMARY = "min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50";
const SECONDARY = "min-h-11 rounded-xl border px-3 font-medium";

const TAG_LABELS: Record<NomenclatureDraft["tags"][number], string> = {
  hydrate: "hydrát",
  "double-salt": "podvojná sůl",
  peroxide: "peroxid",
  "mixed-oxidation": "smíšené oxidační číslo",
  "trivial-name": "triviální název",
};

const DIRECTION_LABELS: Record<NomenclatureDraft["directions"][number], string> = {
  "formula-to-name": "vzorec → název",
  "name-to-formula": "název → vzorec",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toggle<T>(values: readonly T[], value: T, on: boolean): readonly T[] {
  return on
    ? [...values.filter((item) => item !== value), value]
    : values.filter((item) => item !== value);
}

/** Add a published record pending validation, or change a published record. */
export function NomenclatureEditor({
  records,
  record,
  busy,
  onSave,
  onCancel,
}: Readonly<{
  records: readonly NomenclatureRecord[];
  record: NomenclatureRecord | null;
  busy: boolean;
  onSave: (record: NomenclatureRecord) => void;
  onCancel: () => void;
}>) {
  const [draft, setDraft] = useState<NomenclatureDraft>(() =>
    nomenclatureDraft(record ?? undefined),
  );
  const [errors, setErrors] = useState<readonly string[]>([]);
  const formulaHintId = useId();
  const ion = draft.charge.trim() !== "" && Number(draft.charge) !== 0;
  const title = record ? "Upravit záznam" : "Přidat záznam";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = editNomenclatureRecord(records, record, draft, today());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (result.record === record) onCancel();
    else onSave(result.record);
  }

  return (
    <form
      aria-label={title}
      className="mt-3 grid gap-3 rounded-xl border bg-surface-2 p-3 sm:grid-cols-2"
      onSubmit={submit}
    >
      <div className="grid gap-1">
        <label className="grid gap-1 font-medium">
          Vzorec
          <input
            aria-describedby={formulaHintId}
            autoComplete="off"
            className={`${INPUT} font-mono`}
            maxLength={256}
            onChange={(event) => setDraft({ ...draft, formula: event.target.value })}
            required
            spellCheck={false}
            value={draft.formula}
          />
        </label>
        <span className="text-sm text-ink-2" id={formulaHintId}>
          Bez náboje, indexy jako čísla, hydrát s tečkou (uloží se jako CuSO4·5H2O).
        </span>
      </div>
      <label className="grid gap-1 self-start font-medium">
        Náboj (0 u sloučeniny)
        <input
          className={INPUT}
          max={4}
          min={-4}
          onChange={(event) => {
            const charge = event.target.value;
            const nextIon = charge.trim() !== "" && Number(charge) !== 0;
            setDraft({
              ...draft,
              charge,
              directions: nextIon
                ? draft.directions.filter((direction) => direction !== "name-to-formula")
                : draft.directions,
            });
          }}
          required
          step={1}
          type="number"
          value={draft.charge}
        />
      </label>
      <label className="grid gap-1 font-medium sm:col-span-2">
        Název
        <input
          className={INPUT}
          maxLength={200}
          onChange={(event) => setDraft({ ...draft, nameCs: event.target.value })}
          required
          value={draft.nameCs}
        />
      </label>
      <label className="grid gap-1 font-medium sm:col-span-2">
        Vysvětlení
        <textarea
          className="min-h-11 rounded-xl border bg-surface px-3 py-2"
          maxLength={4000}
          onChange={(event) => setDraft({ ...draft, explanationCs: event.target.value })}
          required
          rows={3}
          value={draft.explanationCs}
        />
      </label>
      <label className="grid gap-1 font-medium">
        Kategorie
        <select
          className={INPUT}
          onChange={(event) =>
            setDraft({
              ...draft,
              baseCategory: event.target.value as NomenclatureDraft["baseCategory"],
            })
          }
          required
          value={draft.baseCategory}
        >
          <option value="">Vyberte…</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 font-medium">
        Obtížnost (nepovinné)
        <select
          className={INPUT}
          onChange={(event) =>
            setDraft({
              ...draft,
              difficulty: event.target.value as NomenclatureDraft["difficulty"],
            })
          }
          value={draft.difficulty}
        >
          <option value="">neuvedeno</option>
          <option value="basic">základní</option>
          <option value="intermediate">střední</option>
          <option value="advanced">pokročilá</option>
        </select>
      </label>
      <fieldset className="grid gap-1">
        <legend className="font-medium">Procvičovat</legend>
        {(["formula-to-name", "name-to-formula"] as const).map((direction) => (
          <label className="flex min-h-11 items-center gap-2" key={direction}>
            <input
              checked={draft.directions.includes(direction)}
              disabled={direction === "name-to-formula" && ion}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  directions: toggle(draft.directions, direction, event.target.checked),
                })
              }
              type="checkbox"
            />
            {DIRECTION_LABELS[direction]}
          </label>
        ))}
        {ion ? <span className="text-sm text-ink-2">Ionty jen ze vzorce na název.</span> : null}
      </fieldset>
      <fieldset className="grid gap-1">
        <legend className="font-medium">Štítky (nepovinné)</legend>
        {(Object.keys(TAG_LABELS) as NomenclatureDraft["tags"][number][]).map((tag) => (
          <label className="flex min-h-11 items-center gap-2" key={tag}>
            <input
              checked={draft.tags.includes(tag)}
              onChange={(event) =>
                setDraft({ ...draft, tags: toggle(draft.tags, tag, event.target.checked) })
              }
              type="checkbox"
            />
            {TAG_LABELS[tag]}
          </label>
        ))}
      </fieldset>
      <label className="grid gap-1 font-medium sm:col-span-2">
        Kontext (nepovinné)
        <input
          className={INPUT}
          maxLength={500}
          onChange={(event) => setDraft({ ...draft, contextCs: event.target.value })}
          value={draft.contextCs}
        />
      </label>
      {record ? null : (
        <>
          <label className="grid gap-1 font-medium">
            Zdroj (název)
            <input
              className={INPUT}
              maxLength={300}
              onChange={(event) => setDraft({ ...draft, sourceTitle: event.target.value })}
              required
              value={draft.sourceTitle}
            />
          </label>
          <label className="grid gap-1 font-medium">
            Zdroj (odkaz https://)
            <input
              className={INPUT}
              maxLength={2048}
              onChange={(event) => setDraft({ ...draft, sourceLocator: event.target.value })}
              required
              type="url"
              value={draft.sourceLocator}
            />
          </label>
          <p className="text-sm text-ink-2 sm:col-span-2">
            Nový záznam studenti uvidí po sloučení pull requestu jako neověřený; ověřte ho pak
            stejně jako ostatní.
          </p>
        </>
      )}
      {record?.status === "reviewed" ? (
        <p className="text-sm text-warn sm:col-span-2">
          Změna záznamu zruší jeho ověření; po uložení ho ověřte znovu.
        </p>
      ) : null}
      {errors.length > 0 ? (
        <ul className="grid gap-1 text-bad sm:col-span-2" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={PRIMARY} disabled={busy} type="submit">
          {record ? "Uložit záznam" : "Přidat záznam"}
        </button>
        <button className={SECONDARY} onClick={onCancel} type="button">
          Zrušit
        </button>
      </div>
    </form>
  );
}
