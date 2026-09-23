"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";

const CLOCK_TICK_MS = 250;

export interface Stopwatch {
  readonly elapsedMs: number;
  readonly start: () => void;
  readonly stop: () => void;
}

export function useStopwatch(): Stopwatch {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const running = startedAt !== null && stoppedAt === null;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(interval);
  }, [running]);

  const start = useCallback(() => {
    const startTime = Date.now();
    setStartedAt(startTime);
    setNow(startTime);
    setStoppedAt(null);
  }, []);
  const stop = useCallback(() => setStoppedAt((previous) => previous ?? Date.now()), []);

  return {
    elapsedMs: startedAt === null ? 0 : Math.max(0, (stoppedAt ?? now) - startedAt),
    start,
    stop,
  };
}

interface PracticeDashboardProps {
  readonly correct: number;
  readonly incorrect: number;
  readonly elapsedMs: number;
  readonly running: boolean;
  readonly onReset: () => void;
  readonly onFinish: () => void;
}

export function PracticeDashboard({
  correct,
  incorrect,
  elapsedMs,
  running,
  onReset,
  onFinish,
}: PracticeDashboardProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">
        Správně: {correct}
      </span>
      <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-900">
        Špatně: {incorrect}
      </span>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">
        Čas{" "}
        <span className="font-mono tabular-nums" role="timer">
          {formatElapsed(elapsedMs)}
        </span>
      </span>
      <div className="ml-auto flex gap-2">
        <button
          className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900"
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
        <button
          className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={!running}
          onClick={onFinish}
          type="button"
        >
          Ukončit
        </button>
      </div>
    </div>
  );
}

interface PracticeSummaryProps {
  readonly elapsedMs: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly solved: number;
  readonly total: number;
  readonly solvedLabel: string;
  readonly focusOnMount?: boolean;
  readonly children?: ReactNode;
}

export function PracticeSummary({
  elapsedMs,
  correct,
  incorrect,
  solved,
  total,
  solvedLabel,
  focusOnMount = false,
  children,
}: PracticeSummaryProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const attempts = correct + incorrect;
  const accuracy = attempts === 0 ? "—" : `${Math.round((correct / attempts) * 100)} %`;

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <section
      aria-labelledby={headingId}
      className="mt-6 rounded-2xl border border-emerald-900/15 bg-emerald-50 p-5"
    >
      <h2
        className="text-2xl font-semibold text-slate-950"
        id={headingId}
        ref={headingRef}
        tabIndex={focusOnMount ? -1 : undefined}
      >
        Vyhodnocení cvičení
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryFact label="Čas" value={formatElapsed(elapsedMs)} />
        <SummaryFact label="Správně" value={String(correct)} />
        <SummaryFact label="Špatně" value={String(incorrect)} />
        <SummaryFact label={solvedLabel} value={`${solved} z ${total}`} />
        <SummaryFact label="Úspěšnost" value={accuracy} />
      </dl>
      {children}
    </section>
  );
}

function SummaryFact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
