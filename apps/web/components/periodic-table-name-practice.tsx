"use client";

import { evaluateAnswer } from "@inorganic/chemistry";
import type { ElementFlashcardData, ElementGroupData } from "@inorganic/content/runtime";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  type PeriodicTableCellResult,
  type PeriodicTableCellState,
  PeriodicTableGrid,
} from "@/components/periodic-table-grid";
import { PeriodicTableScopePicker } from "@/components/periodic-table-scope-picker";
import {
  advanceExerciseSession,
  createExerciseSession,
  type ExerciseRound,
  type ExerciseSessionState,
  submitExerciseAnswer,
} from "@/lib/exercise-session";
import {
  appendPeriodicTableAttempt,
  describeAttemptSaveFailure,
} from "@/lib/periodic-table-attempts";
import {
  createPeriodicTableLayout,
  describePeriodicTablePosition,
} from "@/lib/periodic-table-layout";
import {
  drawSeries,
  fullScope,
  listScopeOptions,
  type PeriodicTableScope,
  SERIES_LENGTH,
  selectScopeElements,
} from "@/lib/periodic-table-scope";

interface PeriodicTableNamePracticeProps {
  readonly elements: readonly ElementFlashcardData[];
  readonly groups?: readonly ElementGroupData[];
  readonly random?: () => number;
}

interface SubmittedAnswer {
  readonly text: string;
  readonly missingDiacritics: boolean;
}

const NO_GROUPS: readonly ElementGroupData[] = [];

type ActiveSession = Exclude<
  ExerciseSessionState<ElementFlashcardData>,
  { readonly status: "complete" }
>;

export function PeriodicTableNamePractice({
  elements,
  groups = NO_GROUPS,
  random = Math.random,
}: PeriodicTableNamePracticeProps) {
  const layout = useMemo(() => createPeriodicTableLayout(elements), [elements]);
  const scopeOptions = useMemo(() => listScopeOptions(layout), [layout]);
  const groupNames = useMemo(
    () => new Map(groups.map((group) => [group.groupNumber, group.nameCs])),
    [groups],
  );
  const [scope, setScope] = useState<PeriodicTableScope>(() => fullScope(scopeOptions));
  const [seriesLength, setSeriesLength] = useState(0);
  const [session, setSession] = useState<ExerciseSessionState<ElementFlashcardData> | null>(null);
  const [results, setResults] = useState<ReadonlyMap<string, PeriodicTableCellResult>>(
    () => new Map(),
  );
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState<SubmittedAnswer | null>(null);
  const [inputHint, setInputHint] = useState("");
  const [notice, setNotice] = useState("");
  const submitGuardRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);
  const status = session?.status;

  useEffect(() => {
    if (status === "active") inputRef.current?.focus();
    if (status === "feedback") nextButtonRef.current?.focus();
    if (status === "complete") restartButtonRef.current?.focus();
  }, [status]);

  const scopeElements = selectScopeElements(layout, scope);
  const plannedLength = Math.min(SERIES_LENGTH, scopeElements.length);

  function start() {
    const questions = drawSeries(scopeElements, SERIES_LENGTH, random);
    const created = createExerciseSession(questions);
    if (!created.ok) {
      setNotice("Cvičení nelze zahájit: vyberte alespoň jednu skupinu nebo spodní řadu.");
      return;
    }

    submitGuardRef.current = false;
    setSeriesLength(questions.length);
    setSession(created.state);
    setResults(new Map());
    setAnswer("");
    setSubmitted(null);
    setInputHint("");
    setNotice("");
  }

  function submit() {
    if (session?.status !== "active" || submitGuardRef.current) return;
    if (!answer.trim()) {
      setInputHint("Napište český název prvku.");
      inputRef.current?.focus();
      return;
    }

    submitGuardRef.current = true;
    const question = session.current;
    const evaluation = evaluateAnswer(answer, question.nameCs, { policy: "tolerant" });
    setSubmitted({ text: answer, missingDiacritics: evaluation.match === "missing-diacritics" });
    setInputHint("");
    setResults((previous) =>
      new Map(previous).set(question.id, evaluation.isCorrect ? "solved" : "incorrect"),
    );
    setSession(submitExerciseAnswer(session, evaluation.isCorrect));

    appendPeriodicTableAttempt({
      questionId: question.id,
      round: session.round,
      isCorrect: evaluation.isCorrect,
      direction: "position-to-name",
    }).catch((error: unknown) => setNotice(describeAttemptSaveFailure(error)));
  }

  function returnToSettings() {
    submitGuardRef.current = false;
    setSession(null);
    setResults(new Map());
    setAnswer("");
    setSubmitted(null);
    setInputHint("");
  }

  function advance() {
    if (session?.status !== "feedback") return;

    submitGuardRef.current = false;
    setSession(advanceExerciseSession(session));
    setAnswer("");
    setSubmitted(null);
  }

  if (!session) {
    return (
      <section
        aria-labelledby="periodic-name-setup"
        className="rounded-3xl border border-slate-200 bg-white p-6"
      >
        <h2 id="periodic-name-setup" className="text-2xl font-semibold text-slate-950">
          Nastavení série
        </h2>
        <p className="mt-2 leading-7 text-slate-600">
          Otázky se vyberou náhodně jen z vybraných skupin a řad; tabulka zůstane celá kvůli
          orientaci.
        </p>
        <div className="mt-5">
          <PeriodicTableScopePicker
            groupNames={groupNames}
            onChange={setScope}
            options={scopeOptions}
            scope={scope}
          />
        </div>
        <p aria-live="polite" className="mt-5 text-slate-700">
          {scopeElements.length === 0
            ? "Vyberte alespoň jednu skupinu nebo spodní řadu, jinak nelze cvičení zahájit."
            : `Vybráno ${czechCount(scopeElements.length, ELEMENT_FORMS)}. Série bude mít ${czechCount(plannedLength, QUESTION_FORMS)}.`}
        </p>
        <button
          className="mt-4 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={scopeElements.length === 0}
          onClick={start}
          type="button"
        >
          Začít cvičení ({czechCount(plannedLength, QUESTION_FORMS)})
        </button>
        <PracticeNotice notice={notice} />
      </section>
    );
  }

  const currentElementId = session.status === "complete" ? undefined : session.current.id;
  const currentPosition = layout.find(({ element }) => element.id === currentElementId)?.position;
  const positionText = currentPosition
    ? describePeriodicTablePosition(currentPosition)
    : "neurčeno";

  function cellState(elementId: string): PeriodicTableCellState {
    const current = elementId === currentElementId;
    if (current && status === "active") return { current, result: null };
    return { current, result: results.get(elementId) ?? null };
  }

  return (
    <section
      aria-labelledby="periodic-name-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6"
    >
      {session.status === "complete" ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-600">
            {progressLabel(session, seriesLength)}
          </p>
          <button
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-900"
            onClick={returnToSettings}
            type="button"
          >
            Ukončit sérii
          </button>
        </div>
      )}
      <h2 id="periodic-name-heading" className="mt-3 text-3xl font-semibold text-slate-950">
        {session.status === "complete"
          ? "Cvičení dokončeno"
          : "Jak se jmenuje prvek na vybrané pozici?"}
      </h2>
      {session.status === "complete" ? null : (
        <p className="mt-3 leading-7 text-slate-600">Vybraná pozice: {positionText}.</p>
      )}
      <PeriodicTableGrid cellState={cellState} layout={layout} />

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {session.status === "complete" ? null : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Český název
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="min-h-11 rounded-xl border border-slate-300 px-3 text-base disabled:bg-slate-100 disabled:text-slate-600"
                disabled={session.status === "feedback"}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  setInputHint("");
                }}
                onKeyDown={preventRepeatedEnter}
                ref={inputRef}
                spellCheck={false}
                value={session.status === "feedback" ? (submitted?.text ?? "") : answer}
              />
            </label>
            <p aria-live="polite" className="mt-2 min-h-5 text-sm text-amber-800">
              {inputHint}
            </p>
            <button
              className="mt-2 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={session.status === "feedback"}
              type="submit"
            >
              Vyhodnotit
            </button>
          </form>
        )}

        <div>
          <div aria-live="polite">
            {session.status === "feedback" ? (
              <>
                <h3 className="text-2xl font-semibold text-slate-950">
                  {feedbackVerdict(session.isCorrect, session.round)}
                </h3>
                <p className="mt-2 text-lg text-slate-700">
                  {positionText} je <strong>{session.current.nameCs}</strong> (
                  {session.current.symbol}).
                </p>
                {submitted?.missingDiacritics ? (
                  <p className="mt-2 text-sm text-amber-800">
                    Správně — příště prosím doplňte českou diakritiku.
                  </p>
                ) : null}
              </>
            ) : null}
            {session.status === "complete" ? (
              <p className="leading-7 text-slate-700">
                První průchod: {session.summary.initialCorrect} správně,{" "}
                {session.summary.initialIncorrect} chybně. Opakování: {session.summary.retryCorrect}{" "}
                správně, {session.summary.retryIncorrect} chybně.
              </p>
            ) : null}
          </div>
          {session.status === "feedback" ? (
            <button
              className="mt-4 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
              onClick={advance}
              onKeyDown={preventRepeatedEnter}
              ref={nextButtonRef}
              type="button"
            >
              Další prvek
            </button>
          ) : null}
          {session.status === "complete" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
                onClick={start}
                onKeyDown={preventRepeatedEnter}
                ref={restartButtonRef}
                type="button"
              >
                Začít znovu
              </button>
              <button
                className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900"
                onClick={returnToSettings}
                type="button"
              >
                Změnit nastavení
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <PracticeNotice notice={notice} />
    </section>
  );
}

const QUESTION_FORMS = ["otázka", "otázky", "otázek"] as const;
const ELEMENT_FORMS = ["prvek", "prvky", "prvků"] as const;

function czechCount(count: number, forms: readonly [string, string, string]): string {
  if (count === 1) return `${count} ${forms[0]}`;
  if (count >= 2 && count <= 4) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}

function progressLabel(session: ActiveSession, seriesLength: number): string {
  if (session.round === "retry") {
    const retryTotal = session.summary.initialIncorrect;
    return `Opakování chyby ${retryTotal - session.remaining.length} z ${retryTotal}`;
  }
  return `Otázka ${seriesLength - session.remaining.length} z ${seriesLength}`;
}

function feedbackVerdict(isCorrect: boolean, round: ExerciseRound): string {
  if (isCorrect) return "Správně";
  return round === "initial" ? "Zkusíme to ještě jednou" : "Chybně";
}

function preventRepeatedEnter(event: KeyboardEvent<HTMLElement>): void {
  if (event.key === "Enter" && (event.repeat || event.nativeEvent.isComposing)) {
    event.preventDefault();
  }
}

function PracticeNotice({ notice }: { readonly notice: string }) {
  return notice ? (
    <p className="mt-4 text-sm text-slate-700" role="status">
      {notice}
    </p>
  ) : null;
}
