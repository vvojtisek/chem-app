"use client";

import { type ElementAnswerMatch, evaluateElementAnswer } from "@inorganic/chemistry";
import { curriculumContentVersion, type ElementFlashcardData } from "@inorganic/content/runtime";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccount, useCapabilities } from "@/components/auth-gate";
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
import { createPeriodicTableLayout } from "@/lib/periodic-table-layout";
import {
  DEFAULT_ELEMENT_PROMPT_MODE,
  type ElementPromptMode,
  loadNamePracticeMode,
  saveNamePracticeMode,
} from "@/lib/periodic-table-preferences";
import { selectElements } from "@/lib/periodic-table-scope";
import {
  PERIODIC_NAME_SESSION_ID,
  type PeriodicCheckpoint,
  restorePeriodicSession,
} from "@/lib/periodic-table-session";
import {
  answerPracticeQueue,
  createPracticeQueue,
  finishPracticeQueue,
  type PracticeQueueState,
} from "@/lib/practice-queue";

interface PeriodicTableNamePracticeProps {
  readonly elements: readonly ElementFlashcardData[];
  readonly random?: () => number;
}

type Session = PracticeQueueState<ElementFlashcardData>;

interface LastAnswer {
  readonly element: ElementFlashcardData;
  readonly isCorrect: boolean;
  readonly match: ElementAnswerMatch;
}

/** The answer input flashes red briefly; the missed cell keeps its ✗ for WRONG_MARK_DURATION_MS. */
export const INPUT_FLASH_DURATION_MS = 1_000;

const MODE_OPTIONS: readonly { readonly mode: ElementPromptMode; readonly label: string }[] = [
  { mode: "name-to-symbol", label: "Název → Značka" },
  { mode: "symbol-to-name", label: "Značka → Název" },
];

export function PeriodicTableNamePractice({
  elements,
  random = Math.random,
}: PeriodicTableNamePracticeProps) {
  const account = useAccount();
  const { canSave } = useCapabilities();
  const layout = useMemo(() => createPeriodicTableLayout(elements), [elements]);
  const elementsById = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );
  const [selection, changeSelection] = useSharedElementSelection(layout, !canSave);
  const [mode, setMode] = useState<ElementPromptMode>(DEFAULT_ELEMENT_PROMPT_MODE);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [runId, setRunId] = useState(0);
  const [answer, setAnswer] = useState("");
  const answerRef = useRef("");
  const [inputHint, setInputHint] = useState("");
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");
  const [inputFlash, setInputFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopwatch = useStopwatch();
  const wrongMarks = useWrongMarks();
  const modeGroupName = useId();
  const persisted = usePeriodicSession(
    PERIODIC_NAME_SESSION_ID,
    curriculumContentVersion,
    (checkpoint: PeriodicCheckpoint) => {
      const restored = restorePeriodicSession(checkpoint, elementsById, curriculumContentVersion);
      if (checkpoint.mode === "name-to-position") throw new Error("Neplatný směr cvičení.");
      changeSelection(new Set(checkpoint.selectedIds));
      setMode(checkpoint.mode);
      clearFlash();
      wrongMarks.clear();
      sessionRef.current = restored;
      setSession(restored);
      stopwatch.start(checkpoint.elapsedMs);
      setLastAnswer(null);
      updateAnswer("");
      setRunId((previous) => previous + 1);
      setAnnouncement("Rozpracované cvičení bylo obnoveno.");
    },
  );

  useEffect(() => {
    if (!canSave) return;
    const storedMode = loadNamePracticeMode();
    if (storedMode) setMode(storedMode);
  }, [canSave]);

  const clearFlash = useCallback(() => {
    clearTimeout(flashTimerRef.current);
    setInputFlash(false);
  }, []);

  useEffect(() => clearFlash, [clearFlash]);

  useEffect(() => {
    if (runId > 0) inputRef.current?.focus();
  }, [runId]);

  function updateAnswer(value: string) {
    answerRef.current = value;
    setAnswer(value);
  }

  function changeMode(next: ElementPromptMode) {
    setMode(next);
    if (canSave) saveNamePracticeMode(next);
    updateAnswer("");
    setInputHint("");
    if (sessionRef.current?.status === "running") {
      persisted.save(sessionRef.current, selection, next, stopwatch.readElapsed());
    }
  }

  function start() {
    if (persisted.storageBroken) return;
    const questions = selectElements(layout, selection);
    if (questions.length === 0) return;

    clearFlash();
    wrongMarks.clear();
    const next = createPracticeQueue(questions, random);
    sessionRef.current = next;
    setSession(next);
    setRunId((previous) => previous + 1);
    stopwatch.start();
    updateAnswer("");
    setInputHint("");
    setLastAnswer(null);
    setAnnouncement("");
    setNotice("");
    persisted.save(next, selection, mode, stopwatch.readElapsed());
  }

  function returnToSelection() {
    clearFlash();
    wrongMarks.clear();
    sessionRef.current = null;
    setSession(null);
    stopwatch.stop();
    setLastAnswer(null);
    setAnnouncement("");
    persisted.discard();
  }

  function finish() {
    const current = sessionRef.current;
    if (current?.status !== "running") return;

    const next = finishPracticeQueue(current);
    sessionRef.current = next;
    setSession(next);
    stopwatch.stop();
    setAnnouncement("Cvičení ukončeno.");
    persisted.discard();
  }

  function flashInput() {
    clearTimeout(flashTimerRef.current);
    setInputFlash(true);
    flashTimerRef.current = setTimeout(() => setInputFlash(false), INPUT_FLASH_DURATION_MS);
  }

  function submit() {
    const current = sessionRef.current;
    const question = current?.current;
    if (current?.status !== "running" || !question) return;

    const submitted = answerRef.current;
    if (!submitted.trim()) {
      setInputHint(
        mode === "name-to-symbol" ? "Napište značku prvku." : "Napište český název prvku.",
      );
      inputRef.current?.focus();
      return;
    }

    const evaluation = evaluateElementAnswer(
      submitted,
      question,
      mode === "name-to-symbol" ? "symbol" : "name",
    );
    const result = answerPracticeQueue(current, evaluation.isCorrect);
    if (!result) return;

    sessionRef.current = result.state;
    setSession(result.state);
    updateAnswer("");
    setInputHint("");
    setLastAnswer({ element: question, isCorrect: evaluation.isCorrect, match: evaluation.match });
    if (evaluation.isCorrect) {
      clearFlash();
      wrongMarks.unmark(question.id);
    } else {
      flashInput();
      wrongMarks.mark(question.id);
    }
    if (result.state.status === "finished") stopwatch.stop();
    persisted.save(result.state, selection, mode, stopwatch.readElapsed());
    setAnnouncement(
      `${describeAnswer(question, evaluation.isCorrect)} ${
        result.state.current
          ? `Zadání: ${promptOf(result.state.current, mode)}.`
          : "Cvičení dokončeno."
      }`,
    );
    inputRef.current?.focus();

    if (canSave) {
      appendPeriodicTableAttempt(
        {
          questionId: question.id,
          round: result.round,
          isCorrect: evaluation.isCorrect,
          direction: mode,
        },
        account?.id,
        account?.progressGeneration,
      ).catch((error: unknown) => setNotice(describeAttemptSaveFailure(error)));
    }
  }

  if (persisted.loading) return <p role="status">Načítám uložené cvičení…</p>;

  if (persisted.storageBroken && !session) {
    return (
      <PeriodicSessionNotice
        notice={persisted.notice}
        onRecover={persisted.recover}
        storageBroken
      />
    );
  }

  if (!session) {
    return (
      <>
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
      </>
    );
  }

  const prompt = session.current;

  function cellResult(elementId: string): PeriodicTableCellResult | null {
    if (session?.solvedIds.has(elementId)) return "solved";
    return wrongMarks.marked.has(elementId) ? "incorrect" : null;
  }

  return (
    <div>
      <PracticeDashboard
        correct={session.correct}
        elapsedMs={stopwatch.elapsedMs}
        incorrect={session.incorrect}
        onFinish={finish}
        onReset={start}
        progress={{ done: session.solvedIds.size, total: session.total }}
        running={session.status === "running"}
      />

      <fieldset className="mt-4">
        <legend className="sr-only">Režim procvičování</legend>
        <div className="inline-flex rounded-xl border border-line-strong bg-surface-3 p-1">
          {MODE_OPTIONS.map((option) => (
            <label key={option.mode}>
              <input
                checked={mode === option.mode}
                className="peer sr-only"
                name={modeGroupName}
                onChange={() => changeMode(option.mode)}
                type="radio"
                value={option.mode}
              />
              <span className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-4 text-sm font-semibold text-ink-2 peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                {mode === option.mode ? <span aria-hidden="true">✓</span> : null}
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {prompt ? (
        <section
          aria-label="Otázka"
          className="mt-4 max-w-2xl rounded-2xl border border-line bg-surface p-5 sm:p-7"
        >
          <p className="text-sm font-semibold text-ink-3">
            {mode === "name-to-symbol" ? "Napište značku prvku" : "Napište český název prvku"}
          </p>
          <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            <span className="sr-only">Zadání:</span> {promptOf(prompt, mode)}
          </h2>
          <form
            className="mt-6 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="grid min-w-48 flex-1 gap-1 text-sm font-medium text-ink-2">
              {mode === "name-to-symbol" ? "Značka prvku" : "Český název prvku"}
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className={`min-h-12 rounded-xl border px-3 text-lg text-ink ${
                  inputFlash
                    ? "border-bad bg-bad-soft ring-2 ring-bad"
                    : "border-line-strong bg-surface"
                }`}
                data-flash={inputFlash ? "incorrect" : undefined}
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
              className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-on-fill"
              type="submit"
            >
              Odeslat
            </button>
          </form>
          <p className="mt-2 min-h-5 text-sm text-warn">{inputHint}</p>
          <LastAnswerLine answer={lastAnswer} />
        </section>
      ) : (
        <PracticeSummary
          correct={session.correct}
          elapsedMs={stopwatch.elapsedMs}
          focusOnMount
          incorrect={session.incorrect}
          solved={session.solvedIds.size}
          solvedLabel="Určeno"
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
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <PeriodicTableGrid
        cellResult={cellResult}
        layout={layout}
        secondsLeft={wrongMarks.secondsLeft}
      />
      <PeriodicTableLegend />
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

function LastAnswerLine({ answer }: { readonly answer: LastAnswer | null }) {
  if (!answer) return null;

  return (
    <p
      className={`mt-1 rounded-xl border px-4 py-3 font-semibold ${
        answer.isCorrect
          ? "border-good/40 bg-good-soft text-good"
          : "border-bad/40 bg-bad-soft text-bad"
      }`}
    >
      <span aria-hidden="true">{answer.isCorrect ? "✓ " : "✗ "}</span>
      {describeAnswer(answer.element, answer.isCorrect)}
      {answerHint(answer.match)}
    </p>
  );
}

function describeAnswer(element: ElementFlashcardData, isCorrect: boolean): string {
  return `${isCorrect ? "Správně" : "Špatně"}: ${element.nameCs} (${element.symbol}).`;
}

function answerHint(match: ElementAnswerMatch): string {
  switch (match) {
    case "name-missing-diacritics":
      return " Příště doplňte diakritiku.";
    case "symbol-case-mismatch":
      return " Značka musí mít přesnou velikost písmen.";
    case "name":
    case "symbol":
    case "none":
      return "";
  }
}

function promptOf(element: ElementFlashcardData, mode: ElementPromptMode): string {
  return mode === "name-to-symbol" ? element.nameCs : element.symbol;
}

function preventRepeatedEnter(event: KeyboardEvent<HTMLElement>): void {
  if (event.key === "Enter" && (event.repeat || event.nativeEvent.isComposing)) {
    event.preventDefault();
  }
}
