"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";

const CLOCK_TICK_MS = 250;

export interface Stopwatch {
  readonly elapsedMs: number;
  /** Starts from zero, or from an earlier elapsed time when a practice is resumed. */
  readonly start: (offsetMs?: number) => void;
  readonly stop: () => void;
  /** The exact elapsed time at this moment, for saving a resumable practice. */
  readonly readElapsed: () => number;
}

export function useStopwatch(): Stopwatch {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const timesRef = useRef<{ startedAt: number | null; stoppedAt: number | null }>({
    startedAt: null,
    stoppedAt: null,
  });
  const running = startedAt !== null && stoppedAt === null;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(interval);
  }, [running]);

  const start = useCallback((offsetMs = 0) => {
    const current = Date.now();
    timesRef.current = { startedAt: current - offsetMs, stoppedAt: null };
    setStartedAt(current - offsetMs);
    setNow(current);
    setStoppedAt(null);
  }, []);
  const stop = useCallback(() => {
    const stopTime = timesRef.current.stoppedAt ?? Date.now();
    timesRef.current = { ...timesRef.current, stoppedAt: stopTime };
    setStoppedAt(stopTime);
  }, []);
  const readElapsed = useCallback(() => {
    const { startedAt: started, stoppedAt: stopped } = timesRef.current;
    return started === null ? 0 : Math.max(0, (stopped ?? Date.now()) - started);
  }, []);

  return {
    elapsedMs: startedAt === null ? 0 : Math.max(0, (stoppedAt ?? now) - startedAt),
    start,
    stop,
    readElapsed,
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
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3">
      <span className="rounded-full bg-good-soft px-3 py-1 text-sm font-semibold text-good">
        Správně: {correct}
      </span>
      <span className="rounded-full bg-bad-soft px-3 py-1 text-sm font-semibold text-bad">
        Špatně: {incorrect}
      </span>
      <span className="rounded-full bg-surface-3 px-3 py-1 text-sm font-semibold text-ink">
        Čas{" "}
        <span className="font-mono tabular-nums" role="timer">
          {formatElapsed(elapsedMs)}
        </span>
      </span>
      <div className="ml-auto flex gap-2">
        <button
          className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold text-ink"
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
        <button
          className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:cursor-not-allowed disabled:bg-ink-3"
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
      className="mt-6 rounded-2xl border border-good/15 bg-good-soft p-5"
    >
      <h2
        className="text-2xl font-semibold text-ink"
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
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
