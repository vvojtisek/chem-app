"use client";

import { type ElementAnswerMatch, evaluateElementAnswer } from "@inorganic/chemistry";
import type { ElementFlashcardData } from "@inorganic/content/runtime";
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
import { createPeriodicTableLayout } from "@/lib/periodic-table-layout";
import {
  DEFAULT_ELEMENT_PROMPT_MODE,
  type ElementPromptMode,
  loadNamePracticeMode,
  saveNamePracticeMode,
} from "@/lib/periodic-table-preferences";
import { selectElements } from "@/lib/periodic-table-scope";
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
  }

  function start() {
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
  }

  function returnToSelection() {
    clearFlash();
    wrongMarks.clear();
    sessionRef.current = null;
    setSession(null);
    stopwatch.stop();
    setLastAnswer(null);
    setAnnouncement("");
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
      ).catch((error: unknown) => setNotice(describeAttemptSaveFailure(error)));
    }
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
        running={session.status === "running"}
      />

      <fieldset className="mt-4">
        <legend className="sr-only">Režim procvičování</legend>
        <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-1">
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
              <span className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-4 text-sm font-semibold text-slate-700 peer-checked:bg-white peer-checked:text-slate-950 peer-checked:shadow-sm peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0b7285]">
                {mode === option.mode ? <span aria-hidden="true">✓</span> : null}
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {prompt ? (
        <>
          <h2 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            <span className="sr-only">Zadání:</span> {promptOf(prompt, mode)}
          </h2>
          <form
            className="mt-4 flex max-w-xl flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="grid min-w-48 flex-1 gap-1 text-sm font-medium text-slate-800">
              {mode === "name-to-symbol" ? "Značka prvku" : "Český název prvku"}
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className={`min-h-11 rounded-xl border px-3 text-base ${
                  inputFlash
                    ? "border-rose-600 bg-rose-50 ring-2 ring-rose-300"
                    : "border-slate-300 bg-white"
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
              className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
              type="submit"
            >
              Odeslat
            </button>
          </form>
          <p className="mt-2 min-h-5 text-sm text-amber-800">{inputHint}</p>
          <LastAnswerLine answer={lastAnswer} />
        </>
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
            className="mt-4 min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-900"
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

      <PeriodicTableGrid cellResult={cellResult} layout={layout} />
      {notice ? (
        <p className="mt-4 text-sm text-slate-700" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function LastAnswerLine({ answer }: { readonly answer: LastAnswer | null }) {
  if (!answer) return <p className="min-h-5" />;

  return (
    <p className={`min-h-5 text-sm ${answer.isCorrect ? "text-emerald-800" : "text-rose-800"}`}>
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
