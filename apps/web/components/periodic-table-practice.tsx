"use client";

import { curriculumContentVersion, type ElementFlashcardData } from "@inorganic/content/runtime";
import { useMemo, useRef, useState } from "react";
import { AnswerFeedback } from "@/components/answer-feedback";
import { useAccount, useCapabilities } from "@/components/auth-gate";
import { FinalAnswerReview } from "@/components/final-answer-review";
import styles from "@/components/periodic-practice.module.css";
import { PeriodicSessionNotice } from "@/components/periodic-session-notice";
import {
  type PeriodicTableCellResult,
  PeriodicTableGrid,
  PeriodicTableLegend,
} from "@/components/periodic-table-grid";
import {
  PeriodicTableSelectionStep,
  useSharedElementSelection,
} from "@/components/periodic-table-selection-step";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import { usePeriodicSession } from "@/components/use-periodic-session";
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
  PERIODIC_POSITION_SESSION_ID,
  type PeriodicCheckpoint,
  restorePeriodicSession,
} from "@/lib/periodic-table-session";
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
  const elementsById = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );
  const [selection, changeSelection] = useSharedElementSelection(layout, !canSave);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const wrongMarks = useWrongMarks();
  const stopwatch = useStopwatch();
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");
  const [lastAnswer, setLastAnswer] = useState<{
    element: ElementFlashcardData;
    selected: ElementFlashcardData;
    isCorrect: boolean;
  } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const persisted = usePeriodicSession(
    PERIODIC_POSITION_SESSION_ID,
    curriculumContentVersion,
    (checkpoint: PeriodicCheckpoint) => {
      const restored = restorePeriodicSession(checkpoint, elementsById, curriculumContentVersion);
      changeSelection(new Set(checkpoint.selectedIds));
      wrongMarks.clear();
      sessionRef.current = restored;
      setSession(restored);
      stopwatch.start(checkpoint.elapsedMs);
      setAnnouncement("Rozpracované cvičení bylo obnoveno.");
    },
  );

  function start() {
    setLastAnswer(null);
    setShowResults(false);
    if (persisted.storageBroken) return;
    const questions = selectElements(layout, selection);
    if (questions.length === 0) return;

    wrongMarks.clear();
    const next = createPracticeQueue(questions, random);
    sessionRef.current = next;
    setSession(next);
    stopwatch.start();
    setAnnouncement("");
    setNotice("");
    persisted.save(next, selection, "name-to-position", stopwatch.readElapsed());
  }

  function returnToSelection() {
    wrongMarks.clear();
    sessionRef.current = null;
    setSession(null);
    stopwatch.stop();
    setAnnouncement("");
    persisted.discard();
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
    setLastAnswer({ element: result.question, selected, isCorrect: result.isCorrect });
    if (result.isCorrect) {
      wrongMarks.unmark(selected.id);
    } else {
      wrongMarks.mark(selected.id);
    }
    if (result.state.status === "finished") stopwatch.stop();
    persisted.save(result.state, selection, "name-to-position", stopwatch.readElapsed());
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
        account?.progressGeneration,
      ).catch((error: unknown) => setNotice(describeAttemptSaveFailure(error)));
    }
  }

  function finish() {
    setShowResults(true);
    const current = sessionRef.current;
    if (current?.status !== "running") return;

    const next = finishPracticeQueue(current);
    sessionRef.current = next;
    setSession(next);
    stopwatch.stop();
    setAnnouncement("Cvičení ukončeno.");
    persisted.discard();
  }

  if (persisted.loading) return <p role="status">Načítám uložené cvičení…</p>;

  if (persisted.storageBroken && !session) {
    return (
      <div className={styles.practice}>
        <PeriodicSessionNotice
          notice={persisted.notice}
          onRecover={persisted.recover}
          storageBroken
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.practice}>
        <PeriodicTableSelectionStep
          layout={layout}
          onChange={changeSelection}
          onStart={start}
          selection={selection}
        />
        <PeriodicSessionNotice
          notice={persisted.notice}
          onRecover={persisted.recover}
          storageBroken={false}
        />
      </div>
    );
  }

  function cellResult(elementId: string): PeriodicTableCellResult | null {
    if (session?.solvedIds.has(elementId)) return "solved";
    return wrongMarks.marked.has(elementId) ? "incorrect" : null;
  }

  const finished = session.status === "finished";

  return (
    <div className={styles.practice}>
      <PracticeDashboard
        className={styles.dashboard}
        correct={session.correct}
        elapsedMs={stopwatch.elapsedMs}
        incorrect={session.incorrect}
        onFinish={finish}
        onReset={start}
        progress={{ done: session.solvedIds.size, total: session.total }}
        running={session.status === "running"}
      />

      {finished && lastAnswer && !showResults ? (
        <FinalAnswerReview onShowResults={() => setShowResults(true)}>
          <AnswerFeedback isCorrect={lastAnswer.isCorrect}>
            <p>
              Hledaný prvek: {lastAnswer.element.nameCs} ({lastAnswer.element.symbol}), perioda{" "}
              {lastAnswer.element.period}, skupina {lastAnswer.element.group ?? "f-blok"}.
            </p>
            {!lastAnswer.isCorrect ? (
              <p>
                Vybrali jste: {lastAnswer.selected.nameCs} ({lastAnswer.selected.symbol}).
              </p>
            ) : null}
          </AnswerFeedback>
        </FinalAnswerReview>
      ) : finished ? (
        <PracticeSummary
          className={styles.summary}
          correct={session.correct}
          elapsedMs={stopwatch.elapsedMs}
          incorrect={session.incorrect}
          solved={session.solvedIds.size}
          solvedLabel="Umístěno"
          total={session.total}
        >
          <button
            className="mt-4 min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
            onClick={returnToSelection}
            type="button"
          >
            Změnit výběr
          </button>
        </PracticeSummary>
      ) : (
        // Pinned under the top bar, so the sought element stays in view while the table scrolls.
        <div className={styles.prompt}>
          <p aria-hidden="true" className={styles.promptEyebrow}>
            Najděte
          </p>
          <h2 className={styles.promptTitle}>
            <span className="sr-only">Hledaný prvek:</span> {session.current?.nameCs ?? "…"}
          </h2>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <PeriodicTableGrid
        appearance="practice"
        cellResult={cellResult}
        layout={layout}
        onSelect={finished ? undefined : select}
        secondsLeft={wrongMarks.secondsLeft}
      />
      <PeriodicTableLegend className={styles.legend} />
      {notice ? (
        <p className="mt-4 text-sm text-ink-2" role="status">
          {notice}
        </p>
      ) : null}
      <PeriodicSessionNotice
        notice={persisted.notice}
        onRecover={persisted.recover}
        storageBroken={persisted.storageBroken}
      />
    </div>
  );
}
