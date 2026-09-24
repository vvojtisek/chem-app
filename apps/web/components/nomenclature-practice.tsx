"use client";

import { evaluateNomenclatureAnswer, parseFormula } from "@inorganic/chemistry";
import type { NomenclatureRuntimeRecord } from "@inorganic/content/nomenclature-schema";
import {
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccount, useCapabilities } from "@/components/auth-gate";
import { NomenclatureFilterStep } from "@/components/nomenclature-filters";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import {
  type BrowserNomenclatureStore,
  createBrowserNomenclatureStore,
  LegacyNomenclatureCheckpointError,
} from "@/lib/browser-nomenclature-store";
import type { NomenclatureAttemptEvent } from "@/lib/browser-progress-store";
import { formatFormula, plainFormula } from "@/lib/formula-display";
import {
  loadNomenclatureDirection,
  loadNomenclatureFilters,
  saveNomenclatureDirection,
  saveNomenclatureFilters,
} from "@/lib/nomenclature-preferences";
import {
  DEFAULT_NOMENCLATURE_FILTERS,
  directionFor,
  filterCompounds,
  NOMENCLATURE_CHECKPOINT_VERSION,
  type NomenclatureCheckpoint,
  type NomenclatureDirection,
  type NomenclatureFilters,
} from "@/lib/nomenclature-session";
import {
  answerPracticeQueue,
  createPracticeQueue,
  finishPracticeQueue,
  type PracticeQueueState,
} from "@/lib/practice-queue";

interface NomenclaturePracticeProps {
  readonly compounds: readonly NomenclatureRuntimeRecord[];
  readonly contentVersion: string;
  readonly elementSymbols: readonly string[];
  readonly random?: () => number;
}

type Session = PracticeQueueState<NomenclatureRuntimeRecord>;

interface Feedback {
  readonly record: NomenclatureRuntimeRecord;
  readonly direction: NomenclatureDirection;
  readonly isCorrect: boolean;
  readonly hint: string;
}

const DIRECTION_OPTIONS: readonly {
  readonly direction: NomenclatureDirection;
  readonly label: string;
}[] = [
  { direction: "formula-to-name", label: "Vzorec → Název" },
  { direction: "name-to-formula", label: "Název → Vzorec" },
];

export function NomenclaturePractice({
  compounds,
  contentVersion,
  elementSymbols,
  random = Math.random,
}: NomenclaturePracticeProps) {
  const symbols = useMemo(() => new Set(elementSymbols), [elementSymbols]);
  const byId = useMemo(() => new Map(compounds.map((record) => [record.id, record])), [compounds]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<NomenclatureFilters>(DEFAULT_NOMENCLATURE_FILTERS);
  const [direction, setDirection] = useState<NomenclatureDirection>("formula-to-name");
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [runId, setRunId] = useState(0);
  const [answer, setAnswer] = useState("");
  const answerRef = useRef("");
  const [inputHint, setInputHint] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");
  const [storageBroken, setStorageBroken] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopwatch = useStopwatch();
  const directionGroupName = useId();

  // Persistence of the resumable practice (IndexedDB) and of attempts written with it.
  const storeRef = useRef<BrowserNomenclatureStore | null>(null);
  const account = useAccount();
  const { canSave } = useCapabilities();
  const checkpointRef = useRef<NomenclatureCheckpoint | null>(null);
  const persistedRevisionRef = useRef(0);
  const queuedWritesRef = useRef<Promise<void>>(Promise.resolve());
  const pendingEventsRef = useRef<NomenclatureAttemptEvent[]>([]);
  const localOnlyRef = useRef(false);
  const sessionIdRef = useRef("");
  const sequenceRef = useRef(0);

  function store(): BrowserNomenclatureStore {
    storeRef.current ??= createBrowserNomenclatureStore(globalThis.indexedDB, account?.id);
    return storeRef.current;
  }

  const restoreSaved = useEffectEvent((saved: NomenclatureCheckpoint | null) => {
    if (!saved) return;
    persistedRevisionRef.current = saved.revision;
    const records = [saved.currentId, ...saved.queueIds].map((id) => byId.get(id));
    const [current, ...queued] = records;
    const queue = queued.filter((record) => record !== undefined);
    if (saved.contentVersion !== contentVersion || !current || queue.length !== queued.length) {
      setNotice(
        "Obsah cvičení se od posledního spuštění změnil, rozpracované cvičení bylo ukončeno.",
      );
      discardCheckpoint();
      return;
    }
    checkpointRef.current = saved;
    sessionIdRef.current = saved.sessionId;
    sequenceRef.current = saved.sequence;
    const restored: Session = {
      status: "running",
      current,
      queue,
      solvedIds: new Set(saved.solvedIds),
      missedIds: new Set(saved.missedIds),
      correct: saved.correct,
      incorrect: saved.incorrect,
      total: saved.total,
    };
    sessionRef.current = restored;
    setSession(restored);
    setFilters(saved.filters);
    stopwatch.start(saved.elapsedMs);
    setRunId((previous) => previous + 1);
  });

  const handleLoadFailure = useEffectEvent((error: unknown) => {
    if (error instanceof LegacyNomenclatureCheckpointError) {
      setNotice(
        "Rozpracovaná série ze starší verze cvičení byla ukončena. Historie pokusů zůstala zachována.",
      );
      discardCheckpoint();
      return;
    }
    localOnlyRef.current = true;
    setStorageBroken(true);
    setNotice(
      "Uložené cvičení nelze načíst. Můžete ho odstranit bez smazání historie pokusů; do té doby se nové pokusy neuloží.",
    );
  });

  useEffect(() => {
    if (!canSave) {
      setLoading(false);
      return;
    }
    const storedFilters = loadNomenclatureFilters();
    if (storedFilters) setFilters(storedFilters);
    const storedDirection = loadNomenclatureDirection();
    if (storedDirection) setDirection(storedDirection);

    let mounted = true;
    const browserStore = createBrowserNomenclatureStore(globalThis.indexedDB, account?.id);
    storeRef.current = browserStore;
    browserStore
      .load()
      .then((saved) => {
        if (mounted) restoreSaved(saved);
      })
      .catch((error: unknown) => {
        if (mounted) handleLoadFailure(error);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [account?.id, canSave]);

  useEffect(() => {
    if (runId > 0) inputRef.current?.focus();
  }, [runId]);

  /** Writes the current checkpoint (or removes it when there is none) with pending attempts. */
  function queueWrite(): void {
    if (localOnlyRef.current || !canSave) return;
    queuedWritesRef.current = queuedWritesRef.current
      .then(async () => {
        const current = checkpointRef.current;
        const events = [...pendingEventsRef.current];
        const revision = current ? persistedRevisionRef.current + 1 : 0;
        await store().write(
          current ? { ...current, revision } : null,
          persistedRevisionRef.current,
          events,
        );
        persistedRevisionRef.current = revision;
        const written = new Set(events.map((event) => event.id));
        pendingEventsRef.current = pendingEventsRef.current.filter(
          (event) => !written.has(event.id),
        );
      })
      .catch(() => {
        localOnlyRef.current = true;
        setNotice(
          "Výsledek se nepodařilo uložit. Můžete pokračovat, ale nové pokusy zatím nejsou uložené.",
        );
      });
  }

  function discardCheckpoint(): void {
    checkpointRef.current = null;
    queueWrite();
  }

  function saveProgress(next: Session, sessionId: string, event?: NomenclatureAttemptEvent) {
    if (!canSave) return;
    if (event) pendingEventsRef.current.push(event);
    checkpointRef.current =
      next.status === "running" && next.current
        ? {
            id: "active",
            checkpointVersion: NOMENCLATURE_CHECKPOINT_VERSION,
            revision: persistedRevisionRef.current + 1,
            sessionId,
            contentVersion,
            filters,
            currentId: next.current.id,
            queueIds: next.queue.map((record) => record.id),
            solvedIds: [...next.solvedIds],
            missedIds: [...next.missedIds],
            correct: next.correct,
            incorrect: next.incorrect,
            total: next.total,
            sequence: sequenceRef.current,
            elapsedMs: Math.round(stopwatch.readElapsed()),
          }
        : null;
    queueWrite();
  }

  function changeFilters(next: NomenclatureFilters) {
    setFilters(next);
    if (canSave) saveNomenclatureFilters(next);
  }

  function changeDirection(next: NomenclatureDirection) {
    setDirection(next);
    if (canSave) saveNomenclatureDirection(next);
    updateAnswer("");
    setInputHint("");
  }

  function updateAnswer(value: string) {
    answerRef.current = value;
    setAnswer(value);
  }

  function start() {
    const questions = filterCompounds(compounds, filters);
    if (questions.length === 0) return;
    const next = createPracticeQueue(questions, random);
    sessionIdRef.current = crypto.randomUUID();
    sequenceRef.current = 0;
    sessionRef.current = next;
    setSession(next);
    stopwatch.start();
    updateAnswer("");
    setInputHint("");
    setFeedback(null);
    setAnnouncement("");
    setRunId((previous) => previous + 1);
    saveProgress(next, sessionIdRef.current);
  }

  function finish() {
    const current = sessionRef.current;
    if (current?.status !== "running") return;
    const next = finishPracticeQueue(current);
    sessionRef.current = next;
    setSession(next);
    stopwatch.stop();
    setAnnouncement("Cvičení ukončeno.");
    discardCheckpoint();
  }

  function returnToFilters() {
    const current = sessionRef.current;
    if (current?.status === "running") finish();
    sessionRef.current = null;
    setSession(null);
    setFeedback(null);
    setAnnouncement("");
  }

  function submit() {
    const current = sessionRef.current;
    const record = current?.current;
    if (current?.status !== "running" || !record) return;

    const submitted = answerRef.current;
    const asked = directionFor(record, direction);
    if (!submitted.trim()) {
      setInputHint(
        asked === "formula-to-name" ? "Napište český název." : "Napište chemický vzorec.",
      );
      inputRef.current?.focus();
      return;
    }

    const evaluation = evaluateNomenclatureAnswer(
      {
        direction: asked,
        formula: record.formula,
        nameCs: record.nameCs,
        nameAliases: record.nameAliases,
        formulaAliases: record.formulaAliases,
      },
      submitted,
      "lenient",
      symbols,
    );
    const result = answerPracticeQueue(current, evaluation.isCorrect);
    if (!result) return;

    const sessionId = sessionIdRef.current;
    const sequence = sequenceRef.current;
    sequenceRef.current += 1;
    const common = {
      id: `${sessionId}:${sequence}`,
      eventSchemaVersion: 1 as const,
      sessionId,
      sequence,
      questionId: `${record.id}.${asked}`,
      compoundId: record.id,
      contentVersion,
      occurredAt: new Date().toISOString(),
      isCorrect: evaluation.isCorrect,
      round: result.round,
      mode: "nomenclature" as const,
      outcome: evaluation.isCorrect ? ("correct" as const) : ("incorrect" as const),
      match: evaluation.match,
    };
    const event: NomenclatureAttemptEvent =
      asked === "formula-to-name"
        ? { ...common, direction: "formula-to-name", matchPolicy: "name-lenient" }
        : { ...common, direction: "name-to-formula", matchPolicy: "formula-canonical" };

    sessionRef.current = result.state;
    setSession(result.state);
    updateAnswer("");
    setInputHint("");
    setFeedback({
      record,
      direction: asked,
      isCorrect: evaluation.isCorrect,
      hint:
        evaluation.isCorrect &&
        (evaluation.match === "normalized" || evaluation.match === "missing-diacritics")
          ? ` Přesný zápis: ${record.nameCs}.`
          : "",
    });
    if (result.state.status === "finished") stopwatch.stop();
    const nextRecord = result.state.current;
    setAnnouncement(
      `${evaluation.isCorrect ? "Správně" : "Špatně"}: ${describeRecord(record)}. ${
        nextRecord
          ? `Zadání: ${promptText(nextRecord, directionFor(nextRecord, direction))}.`
          : "Cvičení dokončeno."
      }`,
    );
    saveProgress(result.state, sessionId, event);
    inputRef.current?.focus();
  }

  async function recoverStorage(): Promise<void> {
    try {
      await store().clear();
      persistedRevisionRef.current = 0;
      localOnlyRef.current = false;
      setStorageBroken(false);
      setNotice("Uložené cvičení bylo odstraněno. Historie pokusů zůstala zachována.");
    } catch {
      setNotice("Lokální úložiště stále není dostupné. Cvičit můžete jen do obnovení stránky.");
    }
  }

  if (loading) return <p role="status">Načítám…</p>;

  const notices = (
    <>
      {notice ? (
        <p className="mt-4 text-sm text-slate-700" role="status">
          {notice}
        </p>
      ) : null}
      {storageBroken ? (
        <button
          className="mt-2 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-900"
          onClick={() => void recoverStorage()}
          type="button"
        >
          Odstranit uložené cvičení
        </button>
      ) : null}
    </>
  );

  if (!session) {
    return (
      <>
        <NomenclatureFilterStep
          compounds={compounds}
          filters={filters}
          onChange={changeFilters}
          onStart={start}
        />
        {notices}
      </>
    );
  }

  const record = session.current;
  const asked = record ? directionFor(record, direction) : direction;

  return (
    <div>
      <PracticeDashboard
        correct={session.correct}
        elapsedMs={stopwatch.elapsedMs}
        incorrect={session.incorrect}
        onFinish={finish}
        onReset={start}
        running={session.status === "running"}
      />

      <fieldset className="mt-4">
        <legend className="sr-only">Směr zkoušení</legend>
        <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-1">
          {DIRECTION_OPTIONS.map((option) => (
            <label key={option.direction}>
              <input
                checked={direction === option.direction}
                className="peer sr-only"
                name={directionGroupName}
                onChange={() => changeDirection(option.direction)}
                type="radio"
                value={option.direction}
              />
              <span className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-4 text-sm font-semibold text-slate-700 peer-checked:bg-white peer-checked:text-slate-950 peer-checked:shadow-sm peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0b7285]">
                {direction === option.direction ? <span aria-hidden="true">✓</span> : null}
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {record ? (
        <>
          <h2 className="mt-6 text-4xl font-semibold tracking-tight break-words text-slate-950 sm:text-6xl">
            <span className="sr-only">Zadání:</span>{" "}
            {asked === "formula-to-name" ? (
              <span aria-label={plainFormula(record.formula, record.charge)} role="img">
                {formatFormula(record.formula, record.charge)}
              </span>
            ) : (
              record.nameCs
            )}
          </h2>
          <form
            className="mt-4 flex max-w-xl flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="grid min-w-48 flex-1 gap-1 text-sm font-medium text-slate-800">
              {asked === "formula-to-name" ? "Český název" : "Chemický vzorec"}
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base"
                onChange={(event) => {
                  updateAnswer(event.target.value);
                  setInputHint("");
                }}
                onKeyDown={preventRepeatedEnter}
                ref={inputRef}
                spellCheck={false}
                value={answer}
              />
            </label>
            <button
              className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
              type="submit"
            >
              Odeslat
            </button>
          </form>
          {asked === "name-to-formula" && answer.trim() ? (
            <FormulaPreview input={answer} symbols={symbols} />
          ) : null}
          <p className="mt-2 min-h-5 text-sm text-amber-800">{inputHint}</p>
          <FeedbackLine feedback={feedback} />
        </>
      ) : (
        <PracticeSummary
          correct={session.correct}
          elapsedMs={stopwatch.elapsedMs}
          focusOnMount
          incorrect={session.incorrect}
          solved={session.solvedIds.size}
          solvedLabel="Zodpovězeno"
          total={session.total}
        >
          <button
            className="mt-4 min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-900"
            onClick={returnToFilters}
            type="button"
          >
            Změnit filtry
          </button>
        </PracticeSummary>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {notices}
    </div>
  );
}

function FormulaPreview({
  input,
  symbols,
}: {
  readonly input: string;
  readonly symbols: ReadonlySet<string>;
}) {
  const parsed = parseFormula(input, symbols);
  return (
    <p className="mt-2 text-sm text-slate-600">
      Náhled:{" "}
      {parsed.ok ? (
        <span aria-label={parsed.canonical} role="img">
          {formatFormula(parsed.canonical)}
        </span>
      ) : (
        "vzorec zatím nelze přečíst"
      )}
    </p>
  );
}

function FeedbackLine({ feedback }: { readonly feedback: Feedback | null }) {
  if (!feedback) return <p className="min-h-5" />;
  const { record, isCorrect } = feedback;
  return (
    <div className={`text-sm ${isCorrect ? "text-emerald-800" : "text-rose-800"}`}>
      <p>
        <span aria-hidden="true">{isCorrect ? "✓ " : "✗ "}</span>
        {isCorrect ? "Správně" : "Špatně"}: {describeRecord(record)}.{feedback.hint}
      </p>
      {isCorrect ? null : <p className="mt-1 text-slate-600">{record.explanationCs}</p>}
    </div>
  );
}

function describeRecord(record: NomenclatureRuntimeRecord): string {
  return `${formatFormula(record.formula, record.charge)} = ${record.nameCs}`;
}

function promptText(record: NomenclatureRuntimeRecord, direction: NomenclatureDirection): string {
  return direction === "formula-to-name"
    ? plainFormula(record.formula, record.charge)
    : record.nameCs;
}

function preventRepeatedEnter(event: KeyboardEvent<HTMLElement>): void {
  if (event.key === "Enter" && (event.repeat || event.nativeEvent.isComposing)) {
    event.preventDefault();
  }
}
