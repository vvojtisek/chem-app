"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type PeriodicTableCellState, PeriodicTableGrid } from "@/components/periodic-table-grid";
import {
  answerBlindTable,
  type BlindTableState,
  createBlindTableSession,
  finishBlindTable,
} from "@/lib/blind-table-session";
import {
  appendPeriodicTableAttempt,
  describeAttemptSaveFailure,
} from "@/lib/periodic-table-attempts";
import {
  createPeriodicTableLayout,
  createPeriodicTablePositionKey,
  type PeriodicTablePosition,
} from "@/lib/periodic-table-layout";

interface PeriodicTablePracticeProps {
  readonly elements: readonly ElementFlashcardData[];
  readonly random?: () => number;
}

type Session = BlindTableState<ElementFlashcardData>;

export const WRONG_MARK_DURATION_MS = 10_000;
const CLOCK_TICK_MS = 250;
const BLANK_CELL: PeriodicTableCellState = { current: false, result: null };

export function PeriodicTablePractice({
  elements,
  random = Math.random,
}: PeriodicTablePracticeProps) {
  const layout = useMemo(() => createPeriodicTableLayout(elements), [elements]);
  const elementsByPosition = useMemo(
    () =>
      new Map(
        layout.map(({ element, position }) => [createPeriodicTablePositionKey(position), element]),
      ),
    [layout],
  );
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [wrongCells, setWrongCells] = useState<ReadonlySet<string>>(() => new Set());
  const wrongCellsRef = useRef(new Set<string>());
  const wrongTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");

  const clearWrongMarks = useCallback(() => {
    for (const timer of wrongTimersRef.current.values()) clearTimeout(timer);
    wrongTimersRef.current.clear();
    wrongCellsRef.current = new Set();
    setWrongCells(new Set());
  }, []);

  const reset = useCallback(() => {
    clearWrongMarks();
    const next = createBlindTableSession(elements, random);
    const startTime = Date.now();
    sessionRef.current = next;
    setSession(next);
    setStartedAt(startTime);
    setNow(startTime);
    setStoppedAt(null);
    setAnnouncement("");
    setNotice("");
  }, [clearWrongMarks, elements, random]);

  useEffect(() => {
    reset();
    return clearWrongMarks;
  }, [reset, clearWrongMarks]);

  const running = session?.status === "running" && stoppedAt === null;
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(interval);
  }, [running]);

  function setWrongMark(elementId: string, marked: boolean) {
    const timers = wrongTimersRef.current;
    clearTimeout(timers.get(elementId));
    timers.delete(elementId);

    const next = new Set(wrongCellsRef.current);
    if (marked) {
      next.add(elementId);
      timers.set(
        elementId,
        setTimeout(() => setWrongMark(elementId, false), WRONG_MARK_DURATION_MS),
      );
    } else {
      next.delete(elementId);
    }
    wrongCellsRef.current = next;
    setWrongCells(next);
  }

  function select(position: PeriodicTablePosition) {
    const current = sessionRef.current;
    const selected = elementsByPosition.get(createPeriodicTablePositionKey(position));
    if (!current || !selected) return;
    if (wrongCellsRef.current.has(selected.id) && selected.id !== current.current?.id) return;

    const result = answerBlindTable(current, selected.id);
    if (!result) return;

    sessionRef.current = result.state;
    setSession(result.state);
    setWrongMark(selected.id, !result.isCorrect);
    if (result.state.status === "finished") setStoppedAt(Date.now());
    setAnnouncement(
      `${result.isCorrect ? "Správně" : "Špatně"}. ${
        result.state.current
          ? `Hledaný prvek: ${result.state.current.nameCs}.`
          : "Cvičení dokončeno."
      }`,
    );

    appendPeriodicTableAttempt({
      questionId: result.question.id,
      round: result.round,
      isCorrect: result.isCorrect,
      direction: "name-to-position",
    }).catch((error: unknown) => setNotice(describeAttemptSaveFailure(error)));
  }

  function finish() {
    const current = sessionRef.current;
    if (current?.status !== "running") return;

    const next = finishBlindTable(current);
    sessionRef.current = next;
    setSession(next);
    setStoppedAt(Date.now());
    setAnnouncement("Cvičení ukončeno.");
  }

  function cellState(elementId: string): PeriodicTableCellState {
    if (session?.solvedIds.has(elementId)) return { current: false, result: "solved" };
    if (wrongCells.has(elementId)) return { current: false, result: "incorrect" };
    return BLANK_CELL;
  }

  const finished = session?.status === "finished";
  const elapsedMs = startedAt === null ? 0 : Math.max(0, (stoppedAt ?? now) - startedAt);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">
          Správně: {session?.correct ?? 0}
        </span>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-900">
          Špatně: {session?.incorrect ?? 0}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">
          Čas{" "}
          <span className="font-mono tabular-nums" role="timer">
            {formatElapsed(elapsedMs)}
          </span>
        </span>
        <div className="ml-auto flex gap-2">
          <button
            className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900"
            onClick={reset}
            type="button"
          >
            Reset
          </button>
          <button
            className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={session?.status !== "running"}
            onClick={finish}
            type="button"
          >
            Ukončit
          </button>
        </div>
      </div>

      {finished && session ? (
        <BlindTableSummary elapsedMs={elapsedMs} session={session} />
      ) : (
        <h2 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
          <span className="sr-only">Hledaný prvek:</span> {session?.current?.nameCs ?? "…"}
        </h2>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <PeriodicTableGrid
        cellState={cellState}
        layout={layout}
        onSelect={finished ? undefined : select}
      />
      {notice ? (
        <p className="mt-4 text-sm text-slate-700" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function BlindTableSummary({
  elapsedMs,
  session,
}: {
  readonly elapsedMs: number;
  readonly session: Session;
}) {
  const attempts = session.correct + session.incorrect;
  const accuracy = attempts === 0 ? "—" : `${Math.round((session.correct / attempts) * 100)} %`;

  return (
    <section
      aria-labelledby="blind-table-summary"
      className="mt-6 rounded-2xl border border-emerald-900/15 bg-emerald-50 p-5"
    >
      <h2 id="blind-table-summary" className="text-2xl font-semibold text-slate-950">
        Vyhodnocení cvičení
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryFact label="Čas" value={formatElapsed(elapsedMs)} />
        <SummaryFact label="Správně" value={String(session.correct)} />
        <SummaryFact label="Špatně" value={String(session.incorrect)} />
        <SummaryFact label="Umístěno" value={`${session.solvedIds.size} z ${session.total}`} />
        <SummaryFact label="Úspěšnost" value={accuracy} />
      </dl>
    </section>
  );
}

function SummaryFact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
