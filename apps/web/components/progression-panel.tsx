import type { UserProgression } from "@/lib/api/client";

export function ProgressionPanel({
  progression,
  isLoading,
}: Readonly<{
  progression: UserProgression | undefined;
  isLoading: boolean;
}>) {
  if (!progression) {
    return (
      <section className="mt-6 rounded-2xl border bg-white p-5">
        <p role="status">
          {isLoading ? "Načítám statistiky…" : "Osobní statistiky se nepodařilo načíst."}
        </p>
      </section>
    );
  }
  const maxDaily = Math.max(1, ...progression.trend.map((day) => day.totalAttempts));
  const progressToNext = progression.rank.nextRankAt
    ? Math.min(100, (100 * progression.correctAttempts) / progression.rank.nextRankAt)
    : 100;

  return (
    <section aria-labelledby="progress-heading" className="mt-6 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold" id="progress-heading">
        Souhrn pokroku
      </h2>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">Úroveň</p>
          <p className="text-2xl font-semibold text-emerald-900">{progression.rank.title}</p>
        </div>
        <p className="text-sm text-slate-700">
          {progression.rank.nextRankAt
            ? `${progression.correctAttempts} / ${progression.rank.nextRankAt} správných odpovědí k další úrovni`
            : `${progression.correctAttempts} správných odpovědí · nejvyšší úroveň`}
        </p>
      </div>
      <div
        aria-label={`Postup k další úrovni: ${Math.round(progressToNext)} procent`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(progressToNext)}
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-emerald-700"
          style={{ width: `${progressToNext}%` }}
        />
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-600">Pokusy</dt>
          <dd className="mt-1 text-xl font-semibold">{progression.totalAttempts}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-600">Správně</dt>
          <dd className="mt-1 text-xl font-semibold">{progression.correctAttempts}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-600">Úspěšnost</dt>
          <dd className="mt-1 text-xl font-semibold">{progression.accuracy} %</dd>
        </div>
      </dl>
      <h3 className="mt-6 font-semibold">Posledních 30 dní</h3>
      <ol
        aria-label="Denní počet pokusů za posledních 30 dní"
        className="mt-3 grid grid-cols-10 items-end gap-1 sm:grid-cols-[repeat(30,minmax(0,1fr))]"
      >
        {progression.trend.map((day) => (
          <li className="flex min-w-0 flex-col items-center gap-1" key={day.day}>
            <span className="text-[10px] text-slate-600">{day.totalAttempts}</span>
            <span
              aria-label={`${new Date(`${day.day}T00:00:00Z`).toLocaleDateString("cs-CZ")}: ${day.totalAttempts} pokusů, ${day.correctAttempts} správně`}
              className="w-full rounded-t bg-emerald-700"
              role="img"
              style={{ height: `${Math.max(3, (48 * day.totalAttempts) / maxDaily)}px` }}
            />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-600">
        Souhrn vychází ze synchronizovaných pokusů. Pokusy se ukládají i bez připojení a doplní se
        po synchronizaci.
      </p>
    </section>
  );
}
