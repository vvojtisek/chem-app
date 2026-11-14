"use client";

/**
 * Next steps after a finished round: repeat only the missed items, start another round with
 * the same settings, or go back to the selection.
 */
export function RoundActions({
  missedCount,
  onRetryMissed,
  onNextRound,
  onChangeSelection,
  changeLabel,
}: Readonly<{
  missedCount: number;
  onRetryMissed: () => void;
  onNextRound: () => void;
  onChangeSelection: () => void;
  changeLabel: string;
}>) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {missedCount > 0 ? (
        <button
          className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill hover:bg-accent-strong"
          onClick={onRetryMissed}
          type="button"
        >
          Znovu jen chybné ({missedCount})
        </button>
      ) : null}
      <button
        className={
          missedCount > 0
            ? "min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
            : "min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill hover:bg-accent-strong"
        }
        onClick={onNextRound}
        type="button"
      >
        Další kolo
      </button>
      <button
        className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
        onClick={onChangeSelection}
        type="button"
      >
        {changeLabel}
      </button>
    </div>
  );
}
