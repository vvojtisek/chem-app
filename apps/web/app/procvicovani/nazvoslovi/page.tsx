import {
  curatedElements,
  curatedNomenclature,
  nomenclatureContentVersion,
} from "@inorganic/content/runtime";
import { NomenclaturePractice } from "@/components/nomenclature-practice";
import { PageHeader } from "@/components/page-header";
import { PRACTICE_BREADCRUMB } from "@/components/practice-breadcrumb";

export default function NomenclaturePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[PRACTICE_BREADCRUMB, { label: "Názvosloví" }]}
        title="Procvičování: Názvosloví"
      />
      <NomenclaturePractice
        compounds={curatedNomenclature}
        contentVersion={nomenclatureContentVersion}
        elementSymbols={curatedElements.map((element) => element.symbol)}
      />
    </main>
  );
}
