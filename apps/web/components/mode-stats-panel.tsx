import type { UserAttemptStats } from "@/lib/api/client";
import { czechCount, formatAccuracy } from "@/lib/czech-plural";

const MODE_LABELS: Readonly<Record<UserAttemptStats["byMode"][number]["mode"], string>> = {
  "element-name": "Názvy a značky prvků",
  "periodic-table": "Periodická tabulka",
  nomenclature: "Názvosloví",
  equation: "Chemické rovnice",
};

const ANSWER_FORMS = ["odpověď", "odpovědi", "odpovědí"] as const;

export function ModeStatsPanel({
  stats,
  isLoading,
}: Readonly<{ stats: UserAttemptStats | undefined; isLoading: boolean }>) {
  return (
    <section
      aria-labelledby="mode-stats-heading"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 className="font-display text-xl font-bold text-ink" id="mode-stats-heading">
        Podle režimu
      </h2>
      {!stats ? (
        <p className="mt-3 text-sm text-ink-2" role="status">
          {isLoading
            ? "Načítám souhrny režimů…"
            : "Souhrny režimů nyní nejsou dostupné. Místní přehled prvků zůstává k dispozici."}
        </p>
      ) : stats.byMode.length === 0 ? (
        <p className="mt-3 text-sm text-ink-2">Zatím nejsou synchronizované žádné pokusy.</p>
      ) : (
        <ul className="mt-4 grid list-none gap-4 p-0">
          {stats.byMode.map((item) => {
            const share =
              item.totalAttempts === 0 ? 0 : (100 * item.correctAttempts) / item.totalAttempts;
            return (
              <li key={item.mode}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="font-semibold text-ink">{MODE_LABELS[item.mode]}</h3>
                  <p className="text-sm text-ink-2">
                    <span className="font-semibold text-ink">
                      {formatAccuracy(item.correctAttempts, item.totalAttempts) ?? "—"}
                    </span>{" "}
                    · {item.correctAttempts} správně ·{" "}
                    {czechCount(item.totalAttempts, ANSWER_FORMS)}
                  </p>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
                >
                  <div className="h-full rounded-full bg-good" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-2">Souhrn vychází ze synchronizovaných pokusů.</p>
    </section>
  );
}
