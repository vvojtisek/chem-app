"use client";

import { evaluateNomenclatureAnswer, parseFormula } from "@inorganic/chemistry";
import type { NomenclatureRuntimeRecord } from "@inorganic/content/nomenclature-schema";
import { useEffect, useRef, useState } from "react";
import {
  createBrowserNomenclatureStore,
  type BrowserNomenclatureStore,
} from "@/lib/browser-nomenclature-store";
import type { NomenclatureAttemptEvent } from "@/lib/browser-progress-store";
import {
  advanceExerciseSession,
  createExerciseSession,
  submitExerciseAnswer,
} from "@/lib/exercise-session";
import {
  countInitialAnswered,
  selectNomenclatureQuestions,
  type NomenclatureCheckpoint,
  type NomenclatureSettings,
} from "@/lib/nomenclature-session";

interface NomenclaturePracticeProps {
  readonly compounds: readonly NomenclatureRuntimeRecord[];
  readonly contentVersion: string;
  readonly elementSymbols: readonly string[];
}

const CATEGORY_LABELS = {
  oxide: "Oxidy",
  hydroxide: "Hydroxidy",
  "binary-acid": "Bezkyslíkaté kyseliny a hydridy",
  "binary-salt": "Bezkyslíkaté soli",
  oxoacid: "Kyslíkaté kyseliny",
  "oxoacid-salt": "Kyslíkaté soli",
  hydrogensalt: "Hydrogensoli",
  extension: "Další látky",
  hydrate: "Hydráty",
} as const;

const CORE_CATEGORIES = [
  "oxide",
  "hydroxide",
  "binary-acid",
  "binary-salt",
  "oxoacid",
  "oxoacid-salt",
  "hydrogensalt",
  "hydrate",
] as const;

const DIFFICULTY_LABELS = {
  basic: "Základní",
  intermediate: "Střední",
  advanced: "Pokročilé",
} as const;

function formulaDisplay(formula: string): string {
  const subscripts = "₀₁₂₃₄₅₆₇₈₉";
  return formula.replaceAll(/[0-9]/gu, (digit) => subscripts[Number(digit)] ?? digit);
}

export function NomenclaturePractice({
  compounds,
  contentVersion,
  elementSymbols,
}: NomenclaturePracticeProps) {
  const storeRef = useRef<BrowserNomenclatureStore | null>(null);
  const checkpointRef = useRef<NomenclatureCheckpoint | null>(null);
  const persistedRevisionRef = useRef(0);
  const queuedWritesRef = useRef<Promise<void>>(Promise.resolve());
  const pendingEventsRef = useRef<NomenclatureAttemptEvent[]>([]);
  const localOnlyRef = useRef(false);
  const submitGuardRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const symbols = new Set(elementSymbols);
  const availableCategories = CORE_CATEGORIES.filter((category) =>
    compounds.some(
      (record) =>
        record.baseCategory === category ||
        (category === "hydrate" && record.tags.includes("hydrate")),
    ),
  );
  const availableDifficulties = (["basic", "intermediate", "advanced"] as const).filter(
    (difficulty) => compounds.some((record) => record.difficulty === difficulty),
  );
  const [settings, setSettings] = useState<NomenclatureSettings>({
    categories: availableCategories,
    difficulties: availableDifficulties,
    direction: "formula-to-name",
    namePolicy: "strict",
    length: 10,
  });
  const [checkpoint, setCheckpoint] = useState<NomenclatureCheckpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  function store(): BrowserNomenclatureStore {
    storeRef.current ??= createBrowserNomenclatureStore();
    return storeRef.current;
  }

  useEffect(() => {
    let mounted = true;
    const browserStore = storeRef.current ?? createBrowserNomenclatureStore();
    storeRef.current = browserStore;
    browserStore
      .load()
      .then((saved) => {
        if (!mounted) return;
        if (saved) {
          checkpointRef.current = saved;
          persistedRevisionRef.current = saved.revision;
          setCheckpoint(saved);
          setSettings(saved.settings);
        }
      })
      .catch(() => {
        if (!mounted) return;
        localOnlyRef.current = true;
        setNotice(
          "Uloženou sérii nelze načíst. Můžete ji odstranit bez smazání historie pokusů; nové změny se do té doby neuloží.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (checkpoint?.state.status === "active") inputRef.current?.focus();
  }, [checkpoint?.state.status]);

  function queueWrite(): void {
    if (localOnlyRef.current) return;
    queuedWritesRef.current = queuedWritesRef.current
      .then(async () => {
        const current = checkpointRef.current;
        if (!current || localOnlyRef.current) return;
        const revision = persistedRevisionRef.current + 1;
        const stored = { ...current, revision };
        const events = [...pendingEventsRef.current];
        await store().write(stored, persistedRevisionRef.current, events);
        persistedRevisionRef.current = revision;
        const writtenIds = new Set(events.map((event) => event.id));
        pendingEventsRef.current = pendingEventsRef.current.filter(
          (event) => !writtenIds.has(event.id),
        );
      })
      .catch(() => {
        localOnlyRef.current = true;
        setNotice(
          "Výsledek se nepodařilo uložit. Můžete pokračovat, ale nové pokusy zatím nejsou uložené.",
        );
      });
  }

  function update(next: NomenclatureCheckpoint, event?: NomenclatureAttemptEvent): void {
    checkpointRef.current = next;
    setCheckpoint(next);
    if (event) pendingEventsRef.current.push(event);
    queueWrite();
  }

  function start(): void {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
    const questions = selectNomenclatureQuestions(compounds, settings, seed);
    const created = createExerciseSession(questions);
    if (!created.ok) {
      setNotice("Pro tento výběr nejsou dostupné ověřené otázky.");
      return;
    }
    const previous = checkpointRef.current;
    const next: NomenclatureCheckpoint = {
      id: "active",
      revision: (previous?.revision ?? 0) + 1,
      sessionId: crypto.randomUUID(),
      contentVersion,
      seed,
      initialCount: questions.length,
      sequence: 0,
      revealedInitial: 0,
      revealedRetry: 0,
      settings,
      state: created.state,
      input: "",
      feedback: null,
    };
    submitGuardRef.current = false;
    setShowSetup(false);
    setNotice("");
    update(next);
  }

  function answer(revealed: boolean): void {
    const current = checkpointRef.current;
    if (current?.state.status !== "active" || submitGuardRef.current) return;
    const input = current.input;
    if (!revealed && !input.trim()) {
      setNotice("Napište odpověď nebo zvolte Zobrazit řešení.");
      inputRef.current?.focus();
      return;
    }
    submitGuardRef.current = true;
    const question = current.state.current;
    const evaluation = revealed
      ? { isCorrect: false as const, match: "none" as const }
      : evaluateNomenclatureAnswer(question, input, current.settings.namePolicy, symbols);
    const outcome: NomenclatureAttemptEvent["outcome"] = revealed
      ? "revealed"
      : evaluation.isCorrect
        ? "correct"
        : "incorrect";
    const next: NomenclatureCheckpoint = {
      ...current,
      revision: current.revision + 1,
      sequence: current.sequence + 1,
      state: submitExerciseAnswer(current.state, evaluation.isCorrect),
      feedback: {
        answer: input,
        match: evaluation.match,
        revealed,
      },
      revealedInitial:
        current.revealedInitial + (revealed && current.state.round === "initial" ? 1 : 0),
      revealedRetry: current.revealedRetry + (revealed && current.state.round === "retry" ? 1 : 0),
    };
    const common = {
      id: `${current.sessionId}:${current.sequence}`,
      eventSchemaVersion: 1 as const,
      sessionId: current.sessionId,
      sequence: current.sequence,
      questionId: question.questionId,
      compoundId: question.id,
      contentVersion: current.contentVersion,
      occurredAt: new Date().toISOString(),
      isCorrect: evaluation.isCorrect,
      round: current.state.round,
      mode: "nomenclature" as const,
      outcome,
      match: evaluation.match,
    };
    const event: NomenclatureAttemptEvent =
      question.direction === "formula-to-name"
        ? {
            ...common,
            direction: "formula-to-name",
            matchPolicy:
              current.settings.namePolicy === "strict" ? "name-strict" : "name-diacritics-tolerant",
          }
        : {
            ...common,
            direction: "name-to-formula",
            matchPolicy: "formula-canonical",
          };
    setNotice("");
    update(next, event);
  }

  function advance(): void {
    const current = checkpointRef.current;
    if (current?.state.status !== "feedback") return;
    const state = advanceExerciseSession(current.state);
    submitGuardRef.current = false;
    update({
      ...current,
      revision: current.revision + 1,
      state,
      input: "",
      feedback: null,
    });
  }

  async function newSeries(): Promise<void> {
    await queuedWritesRef.current;
    if (!localOnlyRef.current) {
      try {
        await store().clear();
      } catch {
        localOnlyRef.current = true;
        setNotice("Starou sérii se nepodařilo odstranit z lokálního úložiště.");
      }
    }
    checkpointRef.current = null;
    persistedRevisionRef.current = 0;
    pendingEventsRef.current = [];
    setCheckpoint(null);
    setShowSetup(true);
  }

  async function retrySave(): Promise<void> {
    const current = checkpointRef.current;
    if (!current) return;
    await queuedWritesRef.current;
    try {
      const revision = persistedRevisionRef.current + 1;
      await store().write(
        { ...current, revision },
        persistedRevisionRef.current,
        pendingEventsRef.current,
      );
      persistedRevisionRef.current = revision;
      pendingEventsRef.current = [];
      localOnlyRef.current = false;
      setNotice("Série a čekající pokusy byly uloženy.");
    } catch {
      setNotice("Uložení se stále nedaří. Pokračujte na této stránce a zkuste to znovu.");
    }
  }

  async function recoverSession(): Promise<void> {
    try {
      await store().clear();
      persistedRevisionRef.current = 0;
      localOnlyRef.current = false;
      setNotice("Uložená série byla odstraněna. Historie pokusů zůstala zachována.");
    } catch {
      setNotice("Lokální úložiště stále není dostupné. Cvičit můžete pouze do obnovení stránky.");
    }
  }

  const complete = checkpoint?.state.status === "complete";
  const incompatible =
    checkpoint !== null && checkpoint.contentVersion !== contentVersion && !complete;
  const eligible = selectNomenclatureQuestions(compounds, { ...settings, length: "all" }, 0).length;

  if (loading) return <p role="status">Načítám uloženou sérii…</p>;

  return (
    <div className="space-y-5">
      {compounds.some((record) => record.reviewLevel === "owner-approved") ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          První sada vychází z podkladů{" "}
          <a
            className="underline underline-offset-2"
            href="https://e-learning.vscht.cz/echo/anorganika/nazvoslovi/index.html"
          >
            VŠCHT Praha
          </a>
          . Vlastník projektu ji zkontroloval orientačně; odborná revize jednotlivých položek
          pokračuje.
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        >
          {notice}
        </p>
      ) : null}
      {localOnlyRef.current && checkpoint ? (
        <button
          className="min-h-11 rounded-xl border border-amber-600 px-4 font-semibold"
          onClick={() => void retrySave()}
          type="button"
        >
          Zkusit uložit znovu
        </button>
      ) : null}
      {localOnlyRef.current && !checkpoint ? (
        <button
          className="min-h-11 rounded-xl border border-amber-600 px-4 font-semibold"
          onClick={() => void recoverSession()}
          type="button"
        >
          Odstranit uloženou sérii
        </button>
      ) : null}
      {incompatible ? (
        <section className="rounded-2xl border border-amber-300 bg-white p-6">
          <h2 className="text-xl font-semibold">Obsah cvičení se změnil</h2>
          <p className="mt-2">
            Rozpracovanou sérii nelze bezpečně vyhodnotit s novým obsahem. Historie pokusů zůstává
            uložená.
          </p>
          <button
            className="mt-4 min-h-11 rounded-xl bg-slate-950 px-4 text-white"
            onClick={() => void newSeries()}
            type="button"
          >
            Začít novou sérii
          </button>
        </section>
      ) : checkpoint && !showSetup ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          {checkpoint.state.status === "complete" ? (
            <>
              <h2 className="text-2xl font-semibold">Cvičení dokončeno</h2>
              <p className="mt-3">
                První průchod: {checkpoint.state.summary.initialCorrect} správně z{" "}
                {checkpoint.initialCount}. Chybně: {checkpoint.state.summary.initialIncorrect}, z
                toho zobrazeno řešení: {checkpoint.revealedInitial}.
              </p>
              <p className="mt-2">
                Opakování: {checkpoint.state.summary.retryCorrect} správně,{" "}
                {checkpoint.state.summary.retryIncorrect} chybně; řešení zobrazeno:{" "}
                {checkpoint.revealedRetry}.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Směr:{" "}
                {checkpoint.settings.direction === "formula-to-name"
                  ? "vzorec → název"
                  : "název → vzorec"}
                . Úspěšnost prvního průchodu:{" "}
                {Math.round(
                  (100 * checkpoint.state.summary.initialCorrect) / checkpoint.initialCount,
                )}{" "}
                %.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Výběr:{" "}
                {checkpoint.settings.categories
                  .map((category) => CATEGORY_LABELS[category])
                  .join(", ")}
                ; obtížnost:{" "}
                {checkpoint.settings.difficulties
                  .map((difficulty) => DIFFICULTY_LABELS[difficulty])
                  .join(", ")}
                .
                {checkpoint.settings.direction === "formula-to-name"
                  ? ` Názvy: ${checkpoint.settings.namePolicy === "strict" ? "přesně" : "bez diakritiky"}.`
                  : ""}
              </p>
              <button
                className="mt-5 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
                onClick={() => void newSeries()}
                type="button"
              >
                Nová série
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">
                {checkpoint.state.round === "retry" ? "Opakování chyby" : "Otázka"} ·
                {checkpoint.state.round === "initial"
                  ? " " +
                    (countInitialAnswered(checkpoint.state) + 1) +
                    "/" +
                    checkpoint.initialCount
                  : " " +
                    (checkpoint.state.summary.retryCorrect +
                      checkpoint.state.summary.retryIncorrect +
                      1)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {DIFFICULTY_LABELS[checkpoint.state.current.difficulty]} ·{" "}
                {CATEGORY_LABELS[checkpoint.state.current.baseCategory]}
              </p>
              <p className="mt-5 text-lg font-medium">
                {checkpoint.state.current.direction === "formula-to-name"
                  ? "Jak se česky nazývá tato sloučenina?"
                  : "Jaký je vzorec této sloučeniny?"}
              </p>
              <p
                role="img"
                className="mt-3 break-words text-3xl font-semibold text-slate-950"
                aria-label={
                  checkpoint.state.current.direction === "formula-to-name"
                    ? checkpoint.state.current.formula
                    : checkpoint.state.current.nameCs
                }
              >
                <span aria-hidden="true">
                  {checkpoint.state.current.direction === "formula-to-name"
                    ? formulaDisplay(checkpoint.state.current.formula)
                    : checkpoint.state.current.nameCs}
                </span>
              </p>
              {checkpoint.state.current.contextCs ? (
                <p className="mt-2">{checkpoint.state.current.contextCs}</p>
              ) : null}
              {checkpoint.state.status === "active" ? (
                <form
                  className="mt-6 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    answer(false);
                  }}
                >
                  <label className="grid gap-2 font-medium">
                    {checkpoint.state.current.direction === "formula-to-name"
                      ? "Český název"
                      : "Chemický vzorec"}
                    <input
                      ref={inputRef}
                      className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-700"
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      onChange={(event) => {
                        const current = checkpointRef.current;
                        if (!current) return;
                        update({
                          ...current,
                          revision: current.revision + 1,
                          input: event.target.value,
                        });
                      }}
                      onCompositionStart={() => {
                        submitGuardRef.current = true;
                      }}
                      onCompositionEnd={() => {
                        submitGuardRef.current = false;
                      }}
                      value={checkpoint.input}
                    />
                  </label>
                  {checkpoint.state.current.direction === "name-to-formula" && checkpoint.input ? (
                    <p className="text-sm text-slate-700" aria-live="polite">
                      {(() => {
                        const parsed = parseFormula(checkpoint.input, symbols);
                        return parsed.ok ? (
                          <>
                            <span>Náhled vzorce: </span>
                            <span role="img" aria-label={parsed.canonical}>
                              <span aria-hidden="true">{formulaDisplay(parsed.canonical)}</span>
                            </span>
                          </>
                        ) : (
                          "Vzorec je zatím neúplný nebo neplatný."
                        );
                      })()}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
                      type="submit"
                    >
                      Vyhodnotit
                    </button>
                    <button
                      className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold"
                      onClick={() => answer(true)}
                      type="button"
                    >
                      Zobrazit řešení
                    </button>
                  </div>
                </form>
              ) : checkpoint.state.status === "feedback" ? (
                <div className="mt-6" aria-live="polite">
                  <h2 className="text-2xl font-semibold">
                    {checkpoint.feedback?.revealed
                      ? "Řešení"
                      : checkpoint.state.isCorrect
                        ? "Správně"
                        : "Nesprávně"}
                  </h2>
                  {checkpoint.feedback && !checkpoint.feedback.revealed ? (
                    <p className="mt-2">Vaše odpověď: {checkpoint.feedback.answer}</p>
                  ) : null}
                  <p className="mt-2">
                    Správně: <strong>{checkpoint.state.current.nameCs}</strong> —{" "}
                    <span role="img" aria-label={checkpoint.state.current.formula}>
                      <span aria-hidden="true">
                        {formulaDisplay(checkpoint.state.current.formula)}
                      </span>
                    </span>
                  </p>
                  {checkpoint.feedback?.match === "missing-diacritics" ? (
                    <p className="mt-2 text-amber-800">
                      Správně; příště prosím doplňte diakritiku.
                    </p>
                  ) : null}
                  <p className="mt-4 text-slate-700">
                    <strong>Vysvětlení:</strong> {checkpoint.state.current.explanationCs}
                  </p>
                  <button
                    className="mt-5 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
                    onClick={advance}
                    type="button"
                  >
                    Pokračovat
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : compounds.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Ověřené otázky zatím nejsou dostupné</h2>
          <p className="mt-2 text-slate-700">
            Režim je připravený. Otázky se zpřístupní po chemické revizi názvů, vzorců a vysvětlení.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-2xl font-semibold">Nastavení série</h2>
          <fieldset className="mt-5">
            <legend className="font-semibold">Směr</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {(["formula-to-name", "name-to-formula"] as const).map((direction) => (
                <label className="flex min-h-11 items-center gap-2" key={direction}>
                  <input
                    type="radio"
                    checked={settings.direction === direction}
                    onChange={() => setSettings({ ...settings, direction })}
                  />
                  {direction === "formula-to-name" ? "Vzorec → název" : "Název → vzorec"}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-5">
            <legend className="font-semibold">Kategorie</legend>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {availableCategories.map((category) => (
                <label className="flex min-h-11 items-center gap-2" key={category}>
                  <input
                    type="checkbox"
                    checked={settings.categories.includes(category)}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        categories: event.target.checked
                          ? [...settings.categories, category]
                          : settings.categories.filter((value) => value !== category),
                      })
                    }
                  />
                  {CATEGORY_LABELS[category]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-5">
            <legend className="font-semibold">Obtížnost</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {availableDifficulties.map((difficulty) => (
                <label className="flex min-h-11 items-center gap-2" key={difficulty}>
                  <input
                    type="checkbox"
                    checked={settings.difficulties.includes(difficulty)}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        difficulties: event.target.checked
                          ? [...settings.difficulties, difficulty]
                          : settings.difficulties.filter((value) => value !== difficulty),
                      })
                    }
                  />
                  {DIFFICULTY_LABELS[difficulty]}
                </label>
              ))}
            </div>
          </fieldset>
          {settings.direction === "formula-to-name" ? (
            <fieldset className="mt-5">
              <legend className="font-semibold">Vyhodnocení českého názvu</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {(["strict", "tolerant"] as const).map((policy) => (
                  <label className="flex min-h-11 items-center gap-2" key={policy}>
                    <input
                      type="radio"
                      checked={settings.namePolicy === policy}
                      onChange={() => setSettings({ ...settings, namePolicy: policy })}
                    />
                    {policy === "strict" ? "Přesné" : "Bez diakritiky"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label className="mt-5 grid max-w-xs gap-2 font-semibold">
            Počet otázek
            <select
              className="min-h-11 rounded-xl border border-slate-300 px-3 font-normal"
              value={settings.length}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  length:
                    event.target.value === "all" ? "all" : event.target.value === "20" ? 20 : 10,
                })
              }
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="all">Všechny dostupné</option>
            </select>
          </label>
          <p className="mt-4 text-slate-700" role="status">
            Pro tento výběr je dostupných {eligible} otázek.
          </p>
          {settings.categories.length === 0 || settings.difficulties.length === 0 ? (
            <p className="mt-2 text-amber-800">Vyberte alespoň jednu kategorii a obtížnost.</p>
          ) : eligible === 0 ? (
            <p className="mt-2 text-amber-800">
              Změňte výběr; této kombinaci neodpovídá žádná ověřená otázka.
            </p>
          ) : null}
          <button
            className="mt-4 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={
              eligible === 0 ||
              settings.categories.length === 0 ||
              settings.difficulties.length === 0
            }
            onClick={start}
            type="button"
          >
            Začít cvičení
          </button>
        </section>
      )}
    </div>
  );
}
