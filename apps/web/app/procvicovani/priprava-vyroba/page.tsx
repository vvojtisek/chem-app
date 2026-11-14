import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import { curatedElements } from "@inorganic/content/runtime";
import { PageHeader } from "@/components/page-header";
import { PRACTICE_BREADCRUMB } from "@/components/practice-breadcrumb";
import { ProductionQuiz } from "@/components/production-quiz";

export default function ProductionQuizPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[PRACTICE_BREADCRUMB, { label: "Příprava a výroba" }]}
        title="Příprava a výroba"
      />
      <ProductionQuiz
        allowedSymbols={curatedElements.map((element) => element.symbol)}
        products={curatedPreparationProduction}
      />
    </main>
  );
}
