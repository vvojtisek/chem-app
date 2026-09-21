"use client";

import { curriculumContentVersion, type ElementFlashcardData } from "@inorganic/content/runtime";
import { useState } from "react";

import { createBrowserProgressStore } from "@/lib/browser-progress-store";
import {
  advanceExerciseSession,
  createExerciseSession,
  submitExerciseAnswer,
  type ExerciseSessionState,
} from "@/lib/exercise-session";
import {
  createPeriodicTableLayout,
  createPeriodicTablePositionKey,
  describePeriodicTablePosition,
  type PeriodicTablePosition,
  type PositionedPeriodicTableElement,
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

  function submit(position: PeriodicTablePosition) {
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

    void saveAttempt(session, isCorrect, setNotice);
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
      <PeriodicTableGrid layout={layout} onSelect={submit} />
      <PracticeNotice notice={notice} />
    </section>
  );
}

function PeriodicTableGrid({
  layout,
  onSelect,
}: {
  readonly layout: readonly PositionedPeriodicTableElement<ElementFlashcardData>[];
  readonly onSelect: (position: PeriodicTablePosition) => void;
}) {
  const mainElements = layout.filter(({ position }) => position.section === "main");
  const lanthanides = layout.filter(({ position }) => position.section === "lanthanides");
  const actinides = layout.filter(({ position }) => position.section === "actinides");

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm text-slate-600" id="periodic-grid-help">
        Pro zobrazení celé mřížky na úzké obrazovce posuňte tabulku vodorovně.
      </p>
      <div className="overflow-x-auto pb-3">
        <div className="min-w-180">
          <fieldset aria-describedby="periodic-grid-help" className="grid grid-cols-18 gap-1">
            <legend className="sr-only">Slepá periodická tabulka</legend>
            {mainElements.map(({ element, position }) => (
              <PositionButton
                element={element}
                key={element.id}
                onSelect={onSelect}
                position={position}
              />
            ))}
          </fieldset>
          <PeriodicTableSeries elements={lanthanides} label="Lanthanidy" onSelect={onSelect} />
          <PeriodicTableSeries elements={actinides} label="Aktinidy" onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}

function PeriodicTableSeries({
  elements,
  label,
  onSelect,
}: {
  readonly elements: readonly PositionedPeriodicTableElement<ElementFlashcardData>[];
  readonly label: string;
  readonly onSelect: (position: PeriodicTablePosition) => void;
}) {
  return (
    <section aria-label={label} className="mt-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{label}</h3>
      <div className="grid grid-cols-18 gap-1">
        {elements.map(({ element, position }) => (
          <PositionButton
            element={element}
            key={element.id}
            onSelect={onSelect}
            position={position}
          />
        ))}
      </div>
    </section>
  );
}

function PositionButton({
  element,
  onSelect,
  position,
}: {
  readonly element: ElementFlashcardData;
  readonly onSelect: (position: PeriodicTablePosition) => void;
  readonly position: PeriodicTablePosition;
}) {
  return (
    <button
      aria-label={describePeriodicTablePosition(position)}
      className="min-h-11 rounded-md border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-700 hover:border-emerald-700 hover:bg-emerald-50"
      data-element-id={element.id}
      onClick={() => onSelect(position)}
      style={{
        gridColumn: position.column,
        gridRow: position.section === "main" ? position.row : 1,
      }}
      type="button"
    >
      <span aria-hidden="true">?</span>
    </button>
  );
}

function PracticeNotice({ notice }: { readonly notice: string }) {
  return notice ? (
    <p className="mt-4 text-sm text-slate-700" role="status">
      {notice}
    </p>
  ) : null;
}

async function saveAttempt(
  session: Extract<ExerciseSessionState<ElementFlashcardData>, { readonly status: "active" }>,
  isCorrect: boolean,
  setNotice: (notice: string) => void,
): Promise<void> {
  try {
    await createBrowserProgressStore().appendAttempt({
      id: crypto.randomUUID(),
      questionId: session.current.id,
      contentVersion: curriculumContentVersion,
      occurredAt: new Date().toISOString(),
      isCorrect,
      round: session.round,
      mode: "periodic-table",
      direction: "name-to-position",
      matchPolicy: "exact-position",
    });
  } catch (error: unknown) {
    setNotice(
      error instanceof Error
        ? `Pokus se nepodařilo uložit: ${error.message}`
        : "Pokus se nepodařilo uložit lokálně.",
    );
  }
}
