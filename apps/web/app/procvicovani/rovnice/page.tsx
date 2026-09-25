import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import { curatedElements } from "@inorganic/content/runtime";
import { PageHeader } from "@/components/page-header";
import { PRACTICE_BREADCRUMB } from "@/components/practice-breadcrumb";
import { ReactionEquationPractice } from "@/components/reaction-equation-practice";

export default function EquationPracticePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[PRACTICE_BREADCRUMB, { label: "Chemické rovnice" }]}
        title="Chemické rovnice"
      />
      <ReactionEquationPractice
        products={curatedPreparationProduction}
        allowedSymbols={curatedElements.map((element) => element.symbol)}
      />
    </main>
  );
}
