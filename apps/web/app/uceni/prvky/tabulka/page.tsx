import { curatedElements, curatedGroups } from "@inorganic/content/runtime";
import { PageHeader } from "@/components/page-header";
import { PeriodicTableExplorer } from "@/components/periodic-table-explorer";

export default function PeriodicTableExplorerPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[{ label: "Učivo", href: "/uceni/prvky" }, { label: "Periodická tabulka" }]}
        description="Vyberte políčko a prohlédněte si ověřené údaje o prvku. Značky a názvy se zobrazí až po výběru."
        title="Prozkoumat periodickou tabulku"
      />
      <PeriodicTableExplorer elements={curatedElements} groups={curatedGroups} />
    </main>
  );
}
