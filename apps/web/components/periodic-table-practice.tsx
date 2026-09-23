"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useState } from "react";

import { PeriodicTableGrid } from "@/components/periodic-table-grid";
import {
  advanceExerciseSession,
  createExerciseSession,
  submitExerciseAnswer,
  type ExerciseSessionState,
} from "@/lib/exercise-session";
import {
  appendPeriodicTableAttempt,
  describeAttemptSaveFailure,
} from "@/lib/periodic-table-attempts";
import {
  createPeriodicTableLayout,
  createPeriodicTablePositionKey,
  describePeriodicTablePosition,
  type PeriodicTablePosition,
} from "@/lib/periodic-table-layout";

interface PeriodicTablePracticeProps {
  readonly elements: readonly ElementFlashcardData[];
}

const QUESTION_LIMIT = 10;

export function PeriodicTablePractice({ elements }: PeriodicTablePracticeProps) {
  const layout = createPeriodicTableLayout(elements);
  const [session, setSession] = useState<ExerciseSessionState<ElementFlashcardData> | null>(null);
  const [notice, setNotice] = useState("");

  function start() {
    const created = createExerciseSession(elements.slice(0, QUESTION_LIMIT));
    if (!created.ok) {
      setNotice("Cvičení nelze zahájit: chybí ověřené otázky.");
      return;
    }

    setSession(created.state);
    setNotice("");
  }

  function submitPosition(position: PeriodicTablePosition) {
    if (session?.status !== "active") return;

    const expected = layout.find(({ element }) => element.id === session.current.id);
    if (!expected) {
      setNotice("Cvičení nelze vyhodnotit: chybí ověřená pozice prvku.");
      return;
    }

    const isCorrect =
      createPeriodicTablePositionKey(position) ===
      createPeriodicTablePositionKey(expected.position);
    setSession(submitExerciseAnswer(session, isCorrect));

    appendPeriodicTableAttempt({
      questionId: session.current.id,
      round: session.round,
      isCorrect,
      direction: "name-to-position",
    }).catch((error: unknown) => setNotice(describeAttemptSaveFailure(error)));
  }

  function advance() {
    if (session?.status !== "feedback") return;
    setSession(advanceExerciseSession(session));
  }

  if (!session) {
    return (
      <div>
        <button
          className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
          onClick={start}
          type="button"
        >
          Začít cvičení (10 prvků)
        </button>
        <PracticeNotice notice={notice} />
      </div>
    );
  }

  if (session.status === "complete") {
    return (
      <section
        aria-labelledby="periodic-practice-summary"
        className="rounded-3xl border border-emerald-900/15 bg-emerald-50 p-6"
      >
        <h2 id="periodic-practice-summary" className="text-2xl font-semibold text-slate-950">
          Cvičení dokončeno
        </h2>
        <p className="mt-3 leading-7 text-slate-700">
          První průchod: {session.summary.initialCorrect} správně,{" "}
          {session.summary.initialIncorrect} chybně. Opakování: {session.summary.retryCorrect}{" "}
          správně, {session.summary.retryIncorrect} chybně.
        </p>
        <button
          className="mt-5 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
          onClick={start}
          type="button"
        >
          Začít znovu
        </button>
        <PracticeNotice notice={notice} />
      </section>
    );
  }

  if (session.status === "feedback") {
    const currentPosition = layout.find(
      ({ element }) => element.id === session.current.id,
    )?.position;

    return (
      <section aria-live="polite" className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-600">
          {session.round === "retry" ? "Opakování chyby" : "Zpětná vazba"}
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">
          {session.isCorrect ? "Správně" : "Zkusíme to ještě jednou"}
        </h2>
        <p className="mt-3 text-lg text-slate-700">
          {session.current.nameCs} patří na pozici{" "}
          <strong>
            {currentPosition ? describePeriodicTablePosition(currentPosition) : "neurčeno"}
          </strong>
          .
        </p>
        <button
          className="mt-6 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
          onClick={advance}
          type="button"
        >
          Pokračovat
        </button>
        <PracticeNotice notice={notice} />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="periodic-practice-question"
      className="rounded-3xl border border-slate-200 bg-white p-6"
    >
      <p className="text-sm font-semibold text-slate-600">
        {session.round === "retry" ? "Opakování chyby" : "Otázka"}
      </p>
      <h2 id="periodic-practice-question" className="mt-3 text-3xl font-semibold text-slate-950">
        Kam patří {session.current.nameCs}?
      </h2>
      <p className="mt-3 leading-7 text-slate-600">
        Vyberte prázdnou pozici v periodické tabulce. Tabulka obsahuje i řady lanthanoidů a
        aktinoidů.
      </p>
      <PeriodicTableGrid layout={layout} onSelect={submitPosition} />
      <PracticeNotice notice={notice} />
    </section>
  );
}

function PracticeNotice({ notice }: { readonly notice: string }) {
  return notice ? (
    <p className="mt-4 text-sm text-slate-700" role="status">
      {notice}
    </p>
  ) : null;
}
