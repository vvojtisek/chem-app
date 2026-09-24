"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useMemo, useRef, useState } from "react";
import { useAccount, useCapabilities } from "@/components/auth-gate";
import { type PeriodicTableCellResult, PeriodicTableGrid } from "@/components/periodic-table-grid";
import {
  PeriodicTableSelectionStep,
  useSharedElementSelection,
} from "@/components/periodic-table-selection-step";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import { useWrongMarks } from "@/components/use-wrong-marks";
import {
  appendPeriodicTableAttempt,
  describeAttemptSaveFailure,
} from "@/lib/periodic-table-attempts";
import {
  createPeriodicTableLayout,
  createPeriodicTablePositionKey,
  type PeriodicTablePosition,
} from "@/lib/periodic-table-layout";
import { selectElements } from "@/lib/periodic-table-scope";
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

export function PeriodicTablePractice({
  elements,
  random = Math.random,
}: PeriodicTablePracticeProps) {
  const account = useAccount();
  const { canSave } = useCapabilities();
  const layout = useMemo(() => createPeriodicTableLayout(elements), [elements]);
  const elementsByPosition = useMemo(
    () =>
      new Map(
        layout.map(({ element, position }) => [createPeriodicTablePositionKey(position), element]),
      ),
    [layout],
  );
  const [selection, changeSelection] = useSharedElementSelection(layout, !canSave);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const wrongMarks = useWrongMarks();
  const stopwatch = useStopwatch();
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");

  function start() {
    const questions = selectElements(layout, selection);
    if (questions.length === 0) return;

    wrongMarks.clear();
    const next = createPracticeQueue(questions, random);
    sessionRef.current = next;
    setSession(next);
    stopwatch.start();
    setAnnouncement("");
    setNotice("");
  }

  function returnToSelection() {
    wrongMarks.clear();
    sessionRef.current = null;
    setSession(null);
    stopwatch.stop();
    setAnnouncement("");
  }

  function select(position: PeriodicTablePosition) {
    const current = sessionRef.current;
    const selected = elementsByPosition.get(createPeriodicTablePositionKey(position));
    if (!current || !selected) return;
    if (wrongMarks.isMarked(selected.id) && selected.id !== current.current?.id) return;

    const result = answerPracticeQueueBySelection(current, selected.id);
    if (!result) return;

    sessionRef.current = result.state;
    setSession(result.state);
    if (result.isCorrect) {
      wrongMarks.unmark(selected.id);
    } else {
      wrongMarks.mark(selected.id);
    }
    if (result.state.status === "finished") stopwatch.stop();
    setAnnouncement(
      `${result.isCorrect ? "Správně" : "Špatně"}. ${
        result.state.current
          ? `Hledaný prvek: ${result.state.current.nameCs}.`
          : "Cvičení dokončeno."
      }`,
    );

    if (canSave) {
      appendPeriodicTableAttempt(
        {
          questionId: result.question.id,
          round: result.round,
          isCorrect: result.isCorrect,
          direction: "name-to-position",
        },
        account?.id,
      ).catch((error: unknown) => setNotice(describeAttemptSaveFailure(error)));
    }
  }

  function finish() {
    const current = sessionRef.current;
    if (current?.status !== "running") return;

    const next = finishPracticeQueue(current);
    sessionRef.current = next;
    setSession(next);
    stopwatch.stop();
    setAnnouncement("Cvičení ukončeno.");
  }

  if (!session) {
    return (
      <PeriodicTableSelectionStep
        layout={layout}
        onChange={changeSelection}
        onStart={start}
        selection={selection}
      />
    );
  }

  function cellResult(elementId: string): PeriodicTableCellResult | null {
    if (session?.solvedIds.has(elementId)) return "solved";
    return wrongMarks.marked.has(elementId) ? "incorrect" : null;
  }

  const finished = session.status === "finished";

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

      {finished ? (
        <PracticeSummary
          correct={session.correct}
          elapsedMs={stopwatch.elapsedMs}
          incorrect={session.incorrect}
          solved={session.solvedIds.size}
          solvedLabel="Umístěno"
          total={session.total}
        >
          <button
            className="mt-4 min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-900"
            onClick={returnToSelection}
            type="button"
          >
            Změnit výběr
          </button>
        </PracticeSummary>
      ) : (
        <h2 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
          <span className="sr-only">Hledaný prvek:</span> {session.current?.nameCs ?? "…"}
        </h2>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <PeriodicTableGrid
        cellResult={cellResult}
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
