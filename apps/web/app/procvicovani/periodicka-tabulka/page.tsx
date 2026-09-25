import { curatedElements } from "@inorganic/content/runtime";

import { PageHeader } from "@/components/page-header";
import { PeriodicTablePractice } from "@/components/periodic-table-practice";
import { PRACTICE_BREADCRUMB } from "@/components/practice-breadcrumb";

export default function PeriodicTablePracticePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[PRACTICE_BREADCRUMB, { label: "Slepá periodická tabulka" }]}
        title="Slepá periodická tabulka"
      />
      <PeriodicTablePractice elements={curatedElements} />
    </main>
  );
}
