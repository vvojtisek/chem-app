import { curatedElements } from "@inorganic/content/runtime";

import { PageHeader } from "@/components/page-header";
import { PeriodicTableNamePractice } from "@/components/periodic-table-name-practice";
import { PRACTICE_BREADCRUMB } from "@/components/practice-breadcrumb";

export default function PeriodicTableNamePracticePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[PRACTICE_BREADCRUMB, { label: "Názvy a značky prvků" }]}
        description="Vyberte prvky kliknutím na prvek, číslo skupiny nebo řadu lanthanidů či aktinidů."
        title="Názvy a značky prvků"
      />
      <PeriodicTableNamePractice elements={curatedElements} />
    </main>
  );
}
