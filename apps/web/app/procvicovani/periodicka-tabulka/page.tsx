import { curatedElements } from "@inorganic/content/runtime";

import { PeriodicTablePractice } from "@/components/periodic-table-practice";
import { PRACTICE_HUB_HREF, PracticeNavigation } from "@/components/practice-navigation";

export default function PeriodicTablePracticePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-16">
      <PracticeNavigation backHref={PRACTICE_HUB_HREF} />
      <p className="text-sm font-semibold tracking-[0.16em] text-good uppercase">Procvičování</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
        Slepá periodická tabulka
      </h1>
      <div className="mt-6">
        <PeriodicTablePractice elements={curatedElements} />
      </div>
    </main>
  );
}
