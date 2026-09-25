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
      {notice ? <p className="text-sm text-slate-700">{notice}</p> : null}
      {storageBroken ? (
        <button
          className="mt-2 min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900"
          onClick={() => void onRecover()}
          type="button"
        >
          Odstranit uložené cvičení
        </button>
      ) : null}
    </div>
  );
}
