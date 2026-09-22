"use client";

import { curriculumContentVersion, type ElementFlashcardData } from "@inorganic/content/runtime";
import { evaluateAnswer } from "@inorganic/chemistry";
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
  readonly direction?: PeriodicTablePracticeDirection;
}

export type PeriodicTablePracticeDirection = "name-to-position" | "position-to-name";

const QUESTION_LIMIT = 10;

export function PeriodicTablePractice({
  elements,
  direction = "name-to-position",
}: PeriodicTablePracticeProps) {
  const layout = createPeriodicTableLayout(elements);
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

    void saveAttempt(session, isCorrect, direction, setNotice);
  }

  function submitName() {
    if (session?.status !== "active") return;

    const { isCorrect } = evaluateAnswer(answer, session.current.nameCs, { policy: "tolerant" });

    setSession(submitExerciseAnswer(session, isCorrect));
    void saveAttempt(session, isCorrect, direction, setNotice);
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
          Začít cvičení (10 {direction === "name-to-position" ? "prvků" : "pozic"})
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
          {direction === "name-to-position"
            ? `${session.current.nameCs} patří na pozici `
            : `${currentPosition ? describePeriodicTablePosition(currentPosition) : "Tato pozice"} je `}
          <strong>
            {direction === "name-to-position"
              ? currentPosition
                ? describePeriodicTablePosition(currentPosition)
                : "neurčeno"
              : session.current.nameCs}
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

  if (direction === "position-to-name") {
    const currentPosition = layout.find(
      ({ element }) => element.id === session.current.id,
    )?.position;

    return (
      <form
        aria-labelledby="periodic-practice-question"
        className="rounded-3xl border border-slate-200 bg-white p-6"
        onSubmit={(event) => {
          event.preventDefault();
          submitName();
        }}
      >
        <p className="text-sm font-semibold text-slate-600">
          {session.round === "retry" ? "Opakování chyby" : "Otázka"}
        </p>
        <h2 id="periodic-practice-question" className="mt-3 text-3xl font-semibold text-slate-950">
          Jak se jmenuje prvek na vybrané pozici?
        </h2>
        <p className="mt-3 leading-7 text-slate-600">
          Vybraná pozice:{" "}
          {currentPosition ? describePeriodicTablePosition(currentPosition) : "neurčeno"}.
        </p>
        <PeriodicTableGrid
          interactive={false}
          layout={layout}
          onSelect={submitPosition}
          selectedElementId={session.current.id}
        />
        <label className="mt-7 grid gap-2 text-sm font-medium text-slate-800">
          Český název
          <input
            aria-label="Český název"
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
        <PracticeNotice notice={notice} />
      </form>
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
      <PeriodicTableGrid interactive layout={layout} onSelect={submitPosition} />
      <PracticeNotice notice={notice} />
    </section>
  );
}

function PeriodicTableGrid({
  interactive,
  layout,
  onSelect,
  selectedElementId,
}: {
  readonly layout: readonly PositionedPeriodicTableElement<ElementFlashcardData>[];
  readonly onSelect: (position: PeriodicTablePosition) => void;
  readonly selectedElementId?: string | undefined;
  readonly interactive: boolean;
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
                selected={element.id === selectedElementId}
                interactive={interactive}
              />
            ))}
          </fieldset>
          <PeriodicTableSeries
            elements={lanthanides}
            interactive={interactive}
            label="Lanthanidy"
            onSelect={onSelect}
            selectedElementId={selectedElementId}
          />
          <PeriodicTableSeries
            elements={actinides}
            interactive={interactive}
            label="Aktinidy"
            onSelect={onSelect}
            selectedElementId={selectedElementId}
          />
        </div>
      </div>
    </div>
  );
}

function PeriodicTableSeries({
  elements,
  interactive,
  label,
  onSelect,
  selectedElementId,
}: {
  readonly elements: readonly PositionedPeriodicTableElement<ElementFlashcardData>[];
  readonly label: string;
  readonly onSelect: (position: PeriodicTablePosition) => void;
  readonly selectedElementId?: string | undefined;
  readonly interactive: boolean;
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
            selected={element.id === selectedElementId}
            interactive={interactive}
          />
        ))}
      </div>
    </section>
  );
}

function PositionButton({
  element,
  interactive,
  onSelect,
  position,
  selected,
}: {
  readonly element: ElementFlashcardData;
  readonly onSelect: (position: PeriodicTablePosition) => void;
  readonly position: PeriodicTablePosition;
  readonly selected: boolean;
  readonly interactive: boolean;
}) {
  return (
    <button
      aria-label={
        selected
          ? `Vybraná pozice: ${describePeriodicTablePosition(position)}`
          : describePeriodicTablePosition(position)
      }
      className={`min-h-11 rounded-md border text-sm font-semibold ${selected ? "border-2 border-slate-950 bg-emerald-100 text-slate-950 ring-2 ring-emerald-700/30" : "border-slate-300 bg-slate-50 text-slate-700"}`}
      data-element-id={element.id}
      disabled={!interactive}
      onClick={interactive ? () => onSelect(position) : undefined}
      style={{
        gridColumn: position.column,
        gridRow: position.section === "main" ? position.row : 1,
      }}
      type="button"
    >
      <span aria-hidden="true">{selected ? "●" : "?"}</span>
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
  direction: PeriodicTablePracticeDirection,
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
      direction,
      matchPolicy: direction === "name-to-position" ? "exact-position" : "diacritics-tolerant",
    });
  } catch (error: unknown) {
    setNotice(
      error instanceof Error
        ? `Pokus se nepodařilo uložit: ${error.message}`
        : "Pokus se nepodařilo uložit lokálně.",
    );
  }
}
