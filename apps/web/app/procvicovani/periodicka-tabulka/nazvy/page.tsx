import { curatedElements, curatedGroups } from "@inorganic/content/runtime";

import { PeriodicTableNamePractice } from "@/components/periodic-table-name-practice";

export default function PeriodicTableNamePracticePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-16">
      <p className="text-sm font-semibold tracking-[0.16em] text-emerald-800 uppercase">
        Procvičování
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Název nebo značka podle pozice
      </h1>
      <p className="mt-3 max-w-3xl leading-7 text-slate-600">
        Doplňte český název nebo chemickou značku prvku podle vybrané pozice v periodické tabulce.
        Chybné odpovědi dostanou jeden opakovací pokus na konci cvičení.
      </p>
      <div className="mt-8">
        <PeriodicTableNamePractice elements={curatedElements} groups={curatedGroups} />
      </div>
    </main>
  );
}
