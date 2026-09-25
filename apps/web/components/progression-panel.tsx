import type { UserProgression } from "@/lib/api/client";
import { cn } from "@/lib/class-names";
import { formatPercent } from "@/lib/czech-plural";

const averageFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeZone: "UTC" });

/** Rounds the chart scale up to 5, 10, 20, 50, … so the axis labels stay readable. */
function chartScale(maximum: number): number {
  for (let magnitude = 1; ; magnitude *= 10) {
    for (const step of [1, 2, 5]) {
      if (step * magnitude * 5 >= maximum) return step * magnitude * 5;
    }
  }
}

function dayDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function ProgressionPanel({
  progression,
  isLoading,
}: Readonly<{
  progression: UserProgression | undefined;
  isLoading: boolean;
}>) {
  if (!progression) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <p role="status">
          {isLoading ? "Načítám statistiky…" : "Osobní statistiky se nepodařilo načíst."}
        </p>
      </section>
    );
  }
  const progressToNext = progression.rank.nextRankAt
    ? Math.min(100, (100 * progression.correctAttempts) / progression.rank.nextRankAt)
    : 100;
  const trend = progression.trend;
  const scale = chartScale(Math.max(0, ...trend.map((day) => day.totalAttempts)));
  const average =
    trend.length === 0 ? 0 : trend.reduce((sum, day) => sum + day.totalAttempts, 0) / trend.length;
  const firstDay = trend.at(0);
  const lastDay = trend.at(-1);

  return (
    <section
      aria-labelledby="progress-heading"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 className="font-display text-xl font-bold text-ink" id="progress-heading">
        Souhrn pokroku
      </h2>
      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
        <div>
          <p className="text-sm text-ink-2">Úroveň</p>
          <p className="font-display text-3xl font-bold text-ink">{progression.rank.title}</p>
          <p className="mt-1 text-sm text-ink-2">
            {progression.rank.nextRankAt
              ? `${progression.correctAttempts} / ${progression.rank.nextRankAt} správných odpovědí k další úrovni`
              : `${progression.correctAttempts} správných odpovědí · nejvyšší úroveň`}
          </p>
          <div
            aria-label={`Postup k další úrovni: ${Math.round(progressToNext)} procent`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(progressToNext)}
            className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <SummaryFigure label="Pokusy" value={String(progression.totalAttempts)} />
          <SummaryFigure label="Správně" value={String(progression.correctAttempts)} />
          <SummaryFigure label="Úspěšnost" value={formatPercent(progression.accuracy)} />
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-ink">Pokusy za posledních 30 dní</h3>
        <p className="text-sm text-ink-2">
          <span
            aria-hidden="true"
            className="mr-1.5 inline-block w-5 border-t-2 border-dashed border-flame align-middle"
          />
          průměr {averageFormat.format(average)} denně
        </p>
      </div>
      {trend.length === 0 ? (
        <p className="mt-3 text-sm text-ink-2">Zatím žádné pokusy.</p>
      ) : (
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
          <div
            aria-hidden="true"
            className="flex h-36 flex-col justify-between text-right text-[11px] leading-none text-ink-3 tabular-nums"
          >
            <span>{scale}</span>
            <span>{averageFormat.format(scale / 2)}</span>
            <span>0</span>
          </div>
          <div className="relative h-36 border-b border-line-strong">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-line" />
            <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-line" />
            <ol
              aria-label="Denní počet pokusů za posledních 30 dní"
              className="absolute inset-0 m-0 flex list-none items-end gap-0.5 p-0"
            >
              {trend.map((day, index) => (
                <li className="flex h-full min-w-0 flex-1 items-end" key={day.day}>
                  <span
                    aria-label={`${longDate.format(dayDate(day.day))}: ${day.totalAttempts} pokusů, ${day.correctAttempts} správně`}
                    className={cn(
                      "block w-full rounded-t-sm",
                      index === trend.length - 1 ? "bg-accent" : "bg-accent/45",
                    )}
                    role="img"
                    style={{
                      height:
                        day.totalAttempts === 0 ? "2px" : `${(100 * day.totalAttempts) / scale}%`,
                    }}
                  />
                </li>
              ))}
            </ol>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-flame"
              style={{ bottom: `${(100 * average) / scale}%` }}
            />
          </div>
          <span />
          <div
            aria-hidden="true"
            className="mt-1 flex justify-between text-[11px] text-ink-3 tabular-nums"
          >
            <span>{firstDay ? shortDate.format(dayDate(firstDay.day)) : null}</span>
            <span>{lastDay ? shortDate.format(dayDate(lastDay.day)) : null}</span>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-2">
        Souhrn vychází ze synchronizovaných pokusů. Pokusy se ukládají i bez připojení a doplní se
        po synchronizaci.
      </p>
    </section>
  );
}

function SummaryFigure({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 text-center">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-1 text-xl font-bold whitespace-nowrap text-ink tabular-nums">{value}</dd>
    </div>
  );
}
