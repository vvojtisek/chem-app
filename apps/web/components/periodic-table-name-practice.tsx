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

import { type PeriodicTableCellState, PeriodicTableGrid } from "@/components/periodic-table-grid";
import { PeriodicTableSelectionMatrix } from "@/components/periodic-table-selection-matrix";
import { PracticeDashboard, PracticeSummary, useStopwatch } from "@/components/practice-dashboard";
import {
  appendPeriodicTableAttempt,
  describeAttemptSaveFailure,
} from "@/lib/periodic-table-attempts";
import { createPeriodicTableLayout } from "@/lib/periodic-table-layout";
import {
  DEFAULT_ELEMENT_PROMPT_MODE,
  type ElementPromptMode,
  loadNamePracticeMode,
  loadNamePracticeSelection,
  saveNamePracticeMode,
  saveNamePracticeSelection,
} from "@/lib/periodic-table-name-preferences";
import { defaultSelection, selectElements } from "@/lib/periodic-table-scope";
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

export const WRONG_FLASH_DURATION_MS = 1_000;

const MODE_OPTIONS: readonly { readonly mode: ElementPromptMode; readonly label: string }[] = [
  { mode: "name-to-symbol", label: "Název → Značka" },
  { mode: "symbol-to-name", label: "Značka → Název" },
];

export function PeriodicTableNamePractice({
  elements,
  random = Math.random,
}: PeriodicTableNamePracticeProps) {
  const layout = useMemo(() => createPeriodicTableLayout(elements), [elements]);
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => defaultSelection(layout));
  const [mode, setMode] = useState<ElementPromptMode>(DEFAULT_ELEMENT_PROMPT_MODE);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [practisedIds, setPractisedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [runId, setRunId] = useState(0);
  const [answer, setAnswer] = useState("");
  const answerRef = useRef("");
  const [inputHint, setInputHint] = useState("");
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");
  const [flashElementId, setFlashElementId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopwatch = useStopwatch();
  const modeGroupName = useId();

  useEffect(() => {
    const storedSelection = loadNamePracticeSelection(
      new Set(layout.map(({ element }) => element.id)),
    );
    if (storedSelection) setSelection(storedSelection);
    const storedMode = loadNamePracticeMode();
    if (storedMode) setMode(storedMode);
  }, [layout]);

  const clearFlash = useCallback(() => {
    clearTimeout(flashTimerRef.current);
    setFlashElementId(null);
  }, []);

  useEffect(() => clearFlash, [clearFlash]);

  useEffect(() => {
    if (runId > 0) inputRef.current?.focus();
  }, [runId]);

  const selectedCount = useMemo(
    () => selectElements(layout, selection).length,
    [layout, selection],
  );

  function changeSelection(next: ReadonlySet<string>) {
    setSelection(next);
    saveNamePracticeSelection(next);
  }

  function updateAnswer(value: string) {
    answerRef.current = value;
    setAnswer(value);
  }

  function changeMode(next: ElementPromptMode) {
    setMode(next);
    saveNamePracticeMode(next);
    updateAnswer("");
    setInputHint("");
  }

  function start() {
    const questions = selectElements(layout, selection);
    if (questions.length === 0) return;

    clearFlash();
    const next = createPracticeQueue(questions, random);
    sessionRef.current = next;
    setSession(next);
    setPractisedIds(new Set(questions.map(({ id }) => id)));
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

  function flash(elementId: string) {
    clearTimeout(flashTimerRef.current);
    setFlashElementId(elementId);
    flashTimerRef.current = setTimeout(() => setFlashElementId(null), WRONG_FLASH_DURATION_MS);
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
    } else {
      flash(question.id);
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

    appendPeriodicTableAttempt({
      questionId: question.id,
      round: result.round,
      isCorrect: evaluation.isCorrect,
      direction: mode,
    }).catch((error: unknown) => setNotice(describeAttemptSaveFailure(error)));
  }

  if (!session) {
    return (
      <section
        aria-labelledby="periodic-name-selection"
        className="rounded-3xl border border-slate-200 bg-white p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="periodic-name-selection" className="text-2xl font-semibold text-slate-950">
            Výběr prvků
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-900"
              onClick={() => changeSelection(new Set(layout.map(({ element }) => element.id)))}
              type="button"
            >
              Vybrat vše
            </button>
            <button
              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-900"
              onClick={() => changeSelection(new Set())}
              type="button"
            >
              Zrušit výběr
            </button>
          </div>
        </div>
        <PeriodicTableSelectionMatrix
          layout={layout}
          onChange={changeSelection}
          selection={selection}
        />
        <button
          className="mt-4 min-h-11 rounded-xl bg-slate-950 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={selectedCount === 0}
          onClick={start}
          type="button"
        >
          Přejít na cvičení ({czechCount(selectedCount, ELEMENT_FORMS)})
        </button>
        {selectedCount === 0 ? (
          <p className="mt-2 text-sm text-slate-700">Vyberte alespoň jeden prvek.</p>
        ) : null}
      </section>
    );
  }

  const prompt = session.current;

  function cellState(elementId: string): PeriodicTableCellState {
    const current = elementId === prompt?.id;
    if (session?.solvedIds.has(elementId)) return { current, result: "solved" };
    if (elementId === flashElementId) return { current, result: "incorrect" };
    return { current, result: null, excluded: !practisedIds.has(elementId) };
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
                  flashElementId === null
                    ? "border-slate-300 bg-white"
                    : "border-rose-600 bg-rose-50 ring-2 ring-rose-300"
                }`}
                data-flash={flashElementId === null ? undefined : "incorrect"}
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

      <PeriodicTableGrid cellState={cellState} layout={layout} />
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

const ELEMENT_FORMS = ["prvek", "prvky", "prvků"] as const;

function czechCount(count: number, forms: readonly [string, string, string]): string {
  if (count === 1) return `${count} ${forms[0]}`;
  if (count >= 2 && count <= 4) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}

function preventRepeatedEnter(event: KeyboardEvent<HTMLElement>): void {
  if (event.key === "Enter" && (event.repeat || event.nativeEvent.isComposing)) {
    event.preventDefault();
  }
}
