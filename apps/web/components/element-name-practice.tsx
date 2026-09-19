"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { normalizeAnswer } from "@inorganic/chemistry";
import { useState } from "react";

import { createBrowserProgressStore } from "@/lib/browser-progress-store";
import {
  advanceExerciseSession,
  createExerciseSession,
  submitExerciseAnswer,
  type ExerciseSessionState,
} from "@/lib/exercise-session";

interface ElementNamePracticeProps {
  readonly elements: readonly ElementFlashcardData[];
}
const QUESTION_LIMIT = 10;

export function ElementNamePractice({ elements }: ElementNamePracticeProps) {
  const [session, setSession] = useState<ExerciseSessionState<ElementFlashcardData> | null>(null);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  function start() {
    const created = createExerciseSession(elements.slice(0, QUESTION_LIMIT));
    if (!created.ok) {
      setNotice("Cvičení nelze zahájit: chybí ověřené otázky.");
      return;
    }
    setSession(created.state);
    setAnswer("");
    setNotice("");
  }
  async function submit() {
    if (!session || session.status !== "active") return;
    const isCorrect = normalizeAnswer(answer) === normalizeAnswer(session.current.nameCs);
    setSession(submitExerciseAnswer(session, isCorrect));
    try {
      await createBrowserProgressStore().appendAttempt({
        id: crypto.randomUUID(),
        questionId: session.current.id,
        contentVersion: "elements-2026-09-19",
        occurredAt: new Date().toISOString(),
        isCorrect,
      });
    } catch (error: unknown) {
      setNotice(
        error instanceof Error
          ? `Pokus se nepodařilo uložit: ${error.message}`
          : "Pokus se nepodařilo uložit lokálně.",
      );
    }
  }
  function advance() {
    if (!session || session.status !== "feedback") return;
    setSession(advanceExerciseSession(session));
    setAnswer("");
  }
  if (!session)
    return (
      <button
        className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
        onClick={start}
        type="button"
      >
        Začít cvičení (10 prvků)
      </button>
    );
  if (session.status === "complete")
    return (
      <section
        aria-labelledby="practice-summary"
        className="rounded-3xl border border-emerald-900/15 bg-emerald-50 p-6"
      >
        <h2 id="practice-summary" className="text-2xl font-semibold text-slate-950">
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
      </section>
    );
  if (session.status === "feedback")
    return (
      <section aria-live="polite" className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-600">
          {session.round === "retry" ? "Opakování chyby" : "Zpětná vazba"}
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">
          {session.isCorrect ? "Správně" : "Zkusíme to ještě jednou"}
        </h2>
        <p className="mt-3 text-lg text-slate-700">
          {session.current.symbol} je <strong>{session.current.nameCs}</strong>.
        </p>
        <button
          autoFocus
          className="mt-6 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
          onClick={advance}
          type="button"
        >
          Pokračovat
        </button>
      </section>
    );
  return (
    <form
      className="rounded-3xl border border-slate-200 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm font-semibold text-slate-600">
        {session.round === "retry" ? "Opakování chyby" : "Otázka"}
      </p>
      <p className="mt-5 text-lg text-slate-700">Jak se česky nazývá tento prvek?</p>
      <p className="mt-4 text-7xl font-semibold text-slate-950">{session.current.symbol}</p>
      <label className="mt-7 grid gap-2 text-sm font-medium text-slate-800">
        Český název
        <input
          autoFocus
          className="min-h-11 rounded-xl border border-slate-300 px-3 text-base"
          onChange={(event) => setAnswer(event.target.value)}
          value={answer}
        />
      </label>
      <button
        className="mt-5 min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
        type="submit"
      >
        Vyhodnotit
      </button>
      {notice ? (
        <p className="mt-4 text-sm text-slate-700" role="status">
          {notice}
        </p>
      ) : null}
    </form>
  );
}
