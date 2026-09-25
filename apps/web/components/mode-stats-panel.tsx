import type { UserAttemptStats } from "@/lib/api/client";

const MODE_LABELS: Readonly<Record<UserAttemptStats["byMode"][number]["mode"], string>> = {
  "element-name": "Názvy a značky prvků",
  "periodic-table": "Periodická tabulka",
  nomenclature: "Názvosloví",
  equation: "Chemické rovnice",
};

export function ModeStatsPanel({
  stats,
  isLoading,
}: Readonly<{ stats: UserAttemptStats | undefined; isLoading: boolean }>) {
  return (
    <section
      aria-labelledby="mode-stats-heading"
      className="mt-6 rounded-2xl border bg-surface p-5"
    >
      <h2 className="text-xl font-semibold" id="mode-stats-heading">
        Pokrok podle režimu
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
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {stats.byMode.map((item) => (
            <li className="rounded-xl bg-surface-2 p-4" key={item.mode}>
              <h3 className="font-semibold">{MODE_LABELS[item.mode]}</h3>
              <p className="mt-1 text-sm text-ink-2">
                {item.totalAttempts} pokusů · {item.correctAttempts} správně
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-2">Souhrn vychází ze synchronizovaných pokusů.</p>
    </section>
  );
}
