"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type PeriodicTableCellState, PeriodicTableGrid } from "@/components/periodic-table-grid";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import {
  appendPeriodicTableAttempt,
  describeAttemptSaveFailure,
} from "@/lib/periodic-table-attempts";
import {
  createPeriodicTableLayout,
  createPeriodicTablePositionKey,
  type PeriodicTablePosition,
} from "@/lib/periodic-table-layout";
import {
  answerPracticeQueueBySelection,
  createPracticeQueue,
  finishPracticeQueue,
  type PracticeQueueState,
} from "@/lib/practice-queue";

interface PeriodicTablePracticeProps {
  readonly elements: readonly ElementFlashcardData[];
  readonly random?: () => number;
}

type Session = PracticeQueueState<ElementFlashcardData>;

export const WRONG_MARK_DURATION_MS = 10_000;
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
  const stopwatch = useStopwatch();
  const { start: startStopwatch, stop: stopStopwatch } = stopwatch;
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
    const next = createPracticeQueue(elements, random);
    sessionRef.current = next;
    setSession(next);
    startStopwatch();
    setAnnouncement("");
    setNotice("");
  }, [clearWrongMarks, elements, random, startStopwatch]);

  useEffect(() => {
    reset();
    return clearWrongMarks;
  }, [reset, clearWrongMarks]);

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

    const result = answerPracticeQueueBySelection(current, selected.id);
    if (!result) return;

    sessionRef.current = result.state;
    setSession(result.state);
    setWrongMark(selected.id, !result.isCorrect);
    if (result.state.status === "finished") stopStopwatch();
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

    const next = finishPracticeQueue(current);
    sessionRef.current = next;
    setSession(next);
    stopStopwatch();
    setAnnouncement("Cvičení ukončeno.");
  }

  function cellState(elementId: string): PeriodicTableCellState {
    if (session?.solvedIds.has(elementId)) return { current: false, result: "solved" };
    if (wrongCells.has(elementId)) return { current: false, result: "incorrect" };
    return BLANK_CELL;
  }

  const finished = session?.status === "finished";

  return (
    <div>
      <PracticeDashboard
        correct={session?.correct ?? 0}
        elapsedMs={stopwatch.elapsedMs}
        incorrect={session?.incorrect ?? 0}
        onFinish={finish}
        onReset={reset}
        running={session?.status === "running"}
      />

      {finished && session ? (
        <PracticeSummary
          correct={session.correct}
          elapsedMs={stopwatch.elapsedMs}
          incorrect={session.incorrect}
          solved={session.solvedIds.size}
          solvedLabel="Umístěno"
          total={session.total}
        />
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
