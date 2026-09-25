import { curatedElements } from "@inorganic/content/runtime";

import { PeriodicTableNamePractice } from "@/components/periodic-table-name-practice";
import { PRACTICE_HUB_HREF, PracticeNavigation } from "@/components/practice-navigation";

export default function PeriodicTableNamePracticePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-16">
      <PracticeNavigation backHref={PRACTICE_HUB_HREF} />
      <p className="text-sm font-semibold tracking-[0.16em] text-good uppercase">Procvičování</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
        Názvy a značky prvků
      </h1>
      <p className="mt-3 max-w-3xl leading-7 text-ink-2">
        Vyberte prvky kliknutím na prvek, číslo skupiny nebo řadu lanthanidů či aktinidů.
      </p>
      <div className="mt-8">
        <PeriodicTableNamePractice elements={curatedElements} />
      </div>
    </main>
  );
}
