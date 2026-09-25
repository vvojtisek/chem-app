"use client";

interface PeriodicSessionNoticeProps {
  readonly notice: string;
  readonly storageBroken: boolean;
  readonly onRecover: () => Promise<void>;
}

export function PeriodicSessionNotice({
  notice,
  storageBroken,
  onRecover,
}: PeriodicSessionNoticeProps) {
  if (!notice && !storageBroken) return null;
  return (
    <div className="mt-4" role="status">
      {notice ? <p className="text-sm text-ink-2">{notice}</p> : null}
      {storageBroken ? (
        <button
          className="mt-2 min-h-11 rounded-xl border border-line-strong px-4 font-semibold text-ink"
          onClick={() => void onRecover()}
          type="button"
        >
          Odstranit uložené cvičení
        </button>
      ) : null}
    </div>
  );
}
