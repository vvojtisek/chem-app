"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";

import { CheckIcon, ClockIcon, CrossIcon } from "./icons";

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
  /** Items finished out of the whole set, shown as „12 z 101“ with a progress bar. */
  readonly progress?: { readonly done: number; readonly total: number } | undefined;
  readonly onReset: () => void;
  readonly onFinish: () => void;
}

/**
 * The bar above every exercise: position in the set, live counts, the stopwatch and the two
 * quiet exits. Reset asks for confirmation because it throws away the running order and score.
 */
export function PracticeDashboard({
  correct,
  incorrect,
  elapsedMs,
  running,
  progress,
  onReset,
  onFinish,
}: PracticeDashboardProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const confirmationId = useId();
  const resetButtonRef = useRef<HTMLButtonElement>(null);

  function closeConfirmation() {
    setConfirmingReset(false);
    resetButtonRef.current?.focus();
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        {progress ? <PracticeProgress done={progress.done} total={progress.total} /> : null}
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-good-soft px-3 text-sm font-semibold text-good">
          <CheckIcon />
          <span>Správně: {correct}</span>
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-bad-soft px-3 text-sm font-semibold text-bad">
          <CrossIcon />
          <span>Špatně: {incorrect}</span>
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold text-ink-2">
          <ClockIcon />
          <span className="sr-only">Čas</span>
          <span className="font-mono tabular-nums" role="timer">
            {formatElapsed(elapsedMs)}
          </span>
        </span>
        <div className="ml-auto flex gap-1">
          <button
            aria-controls={confirmingReset ? confirmationId : undefined}
            aria-expanded={confirmingReset}
            className="min-h-11 rounded-xl px-3 font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
            onClick={() => setConfirmingReset((open) => !open)}
            ref={resetButtonRef}
            type="button"
          >
            Reset
          </button>
          <button
            className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:border-line disabled:text-ink-3"
            disabled={!running}
            onClick={onFinish}
            type="button"
          >
            Ukončit
          </button>
        </div>
      </div>
      {confirmingReset ? (
        <fieldset
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-bad/40 bg-bad-soft p-3"
          id={confirmationId}
        >
          <legend className="sr-only">Potvrzení resetu</legend>
          <p className="mr-auto text-sm text-ink">
            Začít znovu se stejným výběrem? Pořadí a skóre tohoto cvičení se vynulují, uložené
            pokusy zůstanou.
          </p>
          <button
            className="min-h-11 rounded-xl bg-bad px-4 font-semibold text-on-fill"
            onClick={() => {
              setConfirmingReset(false);
              onReset();
            }}
            type="button"
          >
            Začít znovu
          </button>
          <button
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
            onClick={closeConfirmation}
            type="button"
          >
            Zrušit
          </button>
        </fieldset>
      ) : null}
    </div>
  );
}

function PracticeProgress({ done, total }: Readonly<{ done: number; total: number }>) {
  const label = `${done} z ${total}`;
  const percent = total === 0 ? 0 : Math.min(100, (100 * done) / total);
  return (
    <div className="flex min-w-40 flex-1 basis-full items-center gap-3 sm:basis-auto">
      <span className="font-mono text-sm font-semibold whitespace-nowrap text-ink tabular-nums">
        {label}
      </span>
      <div
        aria-label="Postup cvičením"
        aria-valuemax={total}
        aria-valuemin={0}
        aria-valuenow={done}
        aria-valuetext={label}
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
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
      className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2
        className="font-display text-2xl font-bold text-ink"
        id={headingId}
        ref={headingRef}
        tabIndex={focusOnMount ? -1 : undefined}
      >
        Vyhodnocení cvičení
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
      <dd className="mt-1 text-xl font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
