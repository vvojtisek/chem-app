"use client";

import type { NomenclatureRecord } from "@inorganic/content/nomenclature-schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";
import { useAccount } from "@/components/auth-gate";
import { curriculumLoadError, curriculumSaveError } from "@/components/curriculum-review";
import { Formula } from "@/components/formula";
import { CATEGORY_LABELS } from "@/components/nomenclature-filters";
import { getNomenclatureCurriculum, saveNomenclatureRecord } from "@/lib/api/client";
import type { ReviewEvidence } from "@/lib/curriculum-review";
import {
  applyNomenclatureAction,
  availableNomenclatureActions,
  countNomenclatureStates,
  type NomenclatureAction,
  type NomenclatureState,
  nomenclatureState,
  toFileRecord,
} from "@/lib/nomenclature-review";
import { queryKeys } from "@/lib/query-keys";

type Filter = NomenclatureState | "all";

const PAGE_SIZE = 50;

const FILTERS: readonly { readonly value: Filter; readonly label: string }[] = [
  { value: "pending", label: "Čeká na ověření" },
  { value: "validated", label: "Ověřeno" },
  { value: "unpublished", label: "Nepublikováno" },
  { value: "removed", label: "Odebráno" },
  { value: "all", label: "Vše" },
];

const STATE_LABELS: Record<NomenclatureState, string> = {
  validated: "Ověřeno",
  pending: "Čeká",
  unpublished: "Nepublikováno",
  removed: "Odebráno",
};

const STATE_CLASSES: Record<NomenclatureState, string> = {
  validated: "border-good bg-good-soft text-good",
  pending: "border-warn bg-warn-soft text-warn",
  unpublished: "border-line-strong bg-surface-2 text-ink-2",
  removed: "border-line-strong bg-surface-2 text-ink-2",
};

const DISPOSITION_LABELS: Record<NomenclatureRecord["disposition"], string> = {
  "core-candidate": "připraveno k vydání",
  "decision-required": "čeká na rozhodnutí",
  "defer-grammar": "odloženo (gramatika)",
  "defer-scope": "odloženo (mimo rozsah)",
};

const PILL =
  "inline-flex min-h-11 items-center gap-1 rounded-full border-2 px-4 text-sm font-semibold";
const PILL_ON = "border-good bg-good-soft text-good";
const PILL_OFF = "border-line-strong bg-surface text-ink-2";
const BUTTON = "min-h-11 rounded-xl border px-3 font-medium disabled:opacity-50";
const PRIMARY = "min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50";

function matchesSearch(record: NomenclatureRecord, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase("cs");
  if (needle.length === 0) return true;
  return [record.nameCs, record.formula, ...record.aliases.names.map(({ value }) => value)].some(
    (text) => text.toLocaleLowerCase("cs").includes(needle),
  );
}

function directionsText(record: NomenclatureRecord): string {
  if (record.directions.length === 0) return "bez procvičování";
  return record.directions
    .map((direction) => (direction === "formula-to-name" ? "vzorec → název" : "název → vzorec"))
    .join(", ");
}

export function NomenclatureReview() {
  const account = useAccount();
  const allowed = account?.role === "admin";
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [openForm, setOpenForm] = useState<{
    readonly id: string;
    readonly kind: "validate" | "remove";
  } | null>(null);
  // The owner works through one document at a time, so the last evidence is reused.
  const [evidence, setEvidence] = useState<ReviewEvidence>({ evidence: "", confirmedBy: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const curriculum = useQuery({
    queryKey: queryKeys.admin.nomenclatureCurriculum,
    queryFn: getNomenclatureCurriculum,
    enabled: allowed,
    retry: false,
  });
  const records = useMemo(() => {
    try {
      return curriculum.data?.records.map(toFileRecord) ?? [];
    } catch {
      return null;
    }
  }, [curriculum.data]);
  const counts = useMemo(() => countNomenclatureStates(records ?? []), [records]);

  if (!allowed) return null;

  const busy = saving || curriculum.isFetching;
  const canValidate = curriculum.data?.canValidate ?? false;

  async function runAction(record: NomenclatureRecord, action: NomenclatureAction) {
    if (!curriculum.data || records === null) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const save = await applyNomenclatureAction(records, record, action);
      await saveNomenclatureRecord(save, curriculum.data.fileSha);
      setOpenForm(null);
      setMessage(
        action.kind === "validate"
          ? "Ověření bylo uloženo do pull requestu."
          : action.kind === "remove"
            ? "Záznam byl odebrán v pull requestu."
            : "Ověření bylo zrušeno v pull requestu.",
      );
    } catch (cause) {
      setError(curriculumSaveError(cause));
    } finally {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.nomenclatureCurriculum });
      setSaving(false);
    }
  }

  function submitValidation(event: FormEvent<HTMLFormElement>, record: NomenclatureRecord) {
    event.preventDefault();
    void runAction(record, { kind: "validate", evidence });
  }

  function renderActions(record: NomenclatureRecord) {
    const actions = availableNomenclatureActions(record);
    const open = openForm?.id === record.id ? openForm.kind : null;
    if (actions.length === 0) return null;

    if (open === "validate")
      return (
        <form
          className="mt-3 grid gap-3 rounded-xl border bg-surface-2 p-3 sm:grid-cols-2"
          onSubmit={(event) => submitValidation(event, record)}
        >
          <label className="grid gap-1 font-medium">
            Doklad (dokument, strana)
            <input
              className="min-h-11 rounded-xl border bg-surface px-3"
              maxLength={300}
              onChange={(event) => setEvidence({ ...evidence, evidence: event.target.value })}
              required
              value={evidence.evidence}
            />
          </label>
          <label className="grid gap-1 font-medium">
            Potvrdil (nepovinné, bude veřejné)
            <input
              className="min-h-11 rounded-xl border bg-surface px-3"
              maxLength={120}
              onChange={(event) => setEvidence({ ...evidence, confirmedBy: event.target.value })}
              value={evidence.confirmedBy}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              className={PRIMARY}
              disabled={busy || evidence.evidence.trim().length === 0}
              type="submit"
            >
              Potvrdit ověření
            </button>
            <button className={BUTTON} onClick={() => setOpenForm(null)} type="button">
              Zrušit
            </button>
          </div>
        </form>
      );

    if (open === "remove")
      return (
        <fieldset className="mt-3 grid gap-3 rounded-xl border border-bad bg-bad-soft p-3">
          <legend className="sr-only">Potvrzení odebrání</legend>
          <p>
            Odebraný záznam nelze vrátit a jeho ID se už nepoužije. Studenti ho přestanou vidět po
            sloučení pull requestu a vydání nové verze.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-xl bg-bad px-4 font-semibold text-on-fill disabled:opacity-50"
              disabled={busy}
              onClick={() => void runAction(record, { kind: "remove" })}
              type="button"
            >
              Odebrat natrvalo
            </button>
            <button className={BUTTON} onClick={() => setOpenForm(null)} type="button">
              Zrušit
            </button>
          </div>
        </fieldset>
      );

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.includes("validate") && canValidate ? (
          <button
            className={PRIMARY}
            disabled={busy}
            onClick={() => setOpenForm({ id: record.id, kind: "validate" })}
            type="button"
          >
            Ověřit
          </button>
        ) : null}
        {actions.includes("unvalidate") ? (
          <button
            className={BUTTON}
            disabled={busy}
            onClick={() => void runAction(record, { kind: "unvalidate" })}
            type="button"
          >
            Zrušit ověření
          </button>
        ) : null}
        {actions.includes("remove") ? (
          <button
            className={`${BUTTON} text-bad`}
            disabled={busy}
            onClick={() => setOpenForm({ id: record.id, kind: "remove" })}
            type="button"
          >
            Odebrat
          </button>
        ) : null}
      </div>
    );
  }

  const matching = (records ?? []).filter(
    (record) =>
      (filter === "all" || nomenclatureState(record) === filter) && matchesSearch(record, search),
  );

  return (
    <section aria-label="Názvosloví">
      <p className="mb-4 max-w-[65ch] text-ink-2">
        Názvy a vzorce sloučenin a iontů. Ověřením potvrzujete název, vzorec, vysvětlení i
        alternativní zápisy podle dokladu. Změny se ukládají do stejného pull requestu jako rovnice;
        studenti je uvidí po jeho sloučení a vydání nové verze.
      </p>
      {curriculum.data && records === null ? (
        <p className="text-bad" role="alert">
          Data v repozitáři neodpovídají schématu. Opravte je v pull requestu a zkuste to znovu.
        </p>
      ) : curriculum.data ? (
        <>
          {curriculum.data.pullRequestUrl ? (
            <p className="rounded-xl border bg-surface p-3">
              Uložené změny čekají v{" "}
              <a
                className="font-semibold text-accent-strong underline"
                href={curriculum.data.pullRequestUrl}
                rel="noreferrer"
                target="_blank"
              >
                pull requestu s úpravami dat
              </a>
              . Po kontrole CI ho slučte, změny pak vyjdou v další verzi.
            </p>
          ) : null}
          {canValidate ? null : (
            <p className="mt-3 rounded-xl border border-warn bg-warn-soft p-3">
              Váš účet není zapsán jako odborník (SME), proto nemůžete ověřovat. Odebrat záznam nebo
              zrušit ověření můžete.
            </p>
          )}

          <p className="mt-4 text-ink-2">
            Záznamy: {counts.validated} ověřeno · {counts.pending} čeká · {counts.unpublished}{" "}
            nepublikováno · {counts.removed} odebráno
          </p>

          <fieldset className="mt-4">
            <legend className="font-semibold text-ink">Zobrazit</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {FILTERS.map((option) => {
                const on = filter === option.value;
                const count =
                  option.value === "all"
                    ? (records ?? []).length
                    : counts[option.value as NomenclatureState];
                return (
                  <button
                    aria-pressed={on}
                    className={`${PILL} ${on ? PILL_ON : PILL_OFF}`}
                    key={option.value}
                    onClick={() => {
                      setFilter(option.value);
                      setShown(PAGE_SIZE);
                    }}
                    type="button"
                  >
                    {option.label}
                    <span className="font-normal text-ink-2">({count})</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="mt-4 grid max-w-md gap-1 font-medium">
            Hledat název nebo vzorec
            <input
              className="min-h-11 rounded-xl border px-3"
              onChange={(event) => {
                setSearch(event.target.value);
                setShown(PAGE_SIZE);
              }}
              type="search"
              value={search}
            />
          </label>

          <div aria-live="polite" className="mt-4 min-h-6">
            {message ? <p className="text-good">{message}</p> : null}
            {curriculum.isFetching && !saving ? <p>Načítám aktuální data…</p> : null}
          </div>
          {error ? (
            <p className="text-bad" role="alert">
              {error}
            </p>
          ) : null}

          {matching.length === 0 ? (
            <p className="mt-4">V tomto výběru nic není.</p>
          ) : (
            <>
              <ul className="mt-4 grid gap-4">
                {matching.slice(0, shown).map((record) => {
                  const state = nomenclatureState(record);
                  const reference = record.sources.find(({ kind }) => kind === "reference");
                  return (
                    <li className="rounded-2xl border bg-surface p-4" key={record.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold">
                          <Formula charge={record.charge} formula={record.formula} /> ·{" "}
                          {record.nameCs}
                        </h2>
                        <span
                          className={`rounded-full border px-3 py-1 text-sm font-semibold ${STATE_CLASSES[state]}`}
                        >
                          {STATE_LABELS[state]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-2">
                        {record.baseCategory
                          ? CATEGORY_LABELS[record.baseCategory]
                          : "bez kategorie"}{" "}
                        · {directionsText(record)}
                      </p>
                      <p className="mt-2">{record.explanationCs}</p>
                      {record.aliases.names.length + record.aliases.formulas.length > 0 ? (
                        <p className="mt-1 text-sm text-ink-2">
                          Uznávané varianty:{" "}
                          {[...record.aliases.names, ...record.aliases.formulas]
                            .map(({ value }) => value)
                            .join(", ")}
                        </p>
                      ) : null}
                      {reference ? (
                        <p className="mt-1 text-sm text-ink-2">
                          Zdroj:{" "}
                          {/^https:\/\//u.test(reference.locator) ? (
                            <a
                              className="underline"
                              href={reference.locator}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {reference.title}
                            </a>
                          ) : (
                            reference.title
                          )}
                        </p>
                      ) : null}
                      {state === "unpublished" ? (
                        <p className="mt-1 text-sm text-warn">
                          Studenti tento záznam nevidí: {DISPOSITION_LABELS[record.disposition]}
                          {record.reviewIssues.length > 0
                            ? `, otevřené body ${record.reviewIssues.join(", ")}`
                            : ""}
                          .
                        </p>
                      ) : null}
                      {record.status === "reviewed" ? (
                        <p className="mt-1 text-sm text-ink-2">
                          Ověřeno{" "}
                          {record.reviewedAt
                            ? new Date(record.reviewedAt).toLocaleDateString("cs-CZ")
                            : ""}
                          {record.reviewEvidence ? ` · doklad: ${record.reviewEvidence}` : ""}
                          {record.reviewEvidenceConfirmedBy
                            ? ` · potvrdil: ${record.reviewEvidenceConfirmedBy}`
                            : ""}
                        </p>
                      ) : null}
                      {renderActions(record)}
                    </li>
                  );
                })}
              </ul>
              {matching.length > shown ? (
                <button
                  className={`${BUTTON} mt-4`}
                  onClick={() => setShown(shown + PAGE_SIZE)}
                  type="button"
                >
                  Zobrazit další ({matching.length - shown} zbývá)
                </button>
              ) : null}
            </>
          )}
        </>
      ) : (
        <p
          className={curriculum.isError ? "text-bad" : ""}
          role={curriculum.isError ? "alert" : "status"}
        >
          {curriculum.isError ? curriculumLoadError(curriculum.error) : "Načítám data…"}
        </p>
      )}
    </section>
  );
}
