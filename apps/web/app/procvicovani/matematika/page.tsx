import { mathTopics } from "@inorganic/content/higher-mathematics";
import { PageHeader } from "@/components/page-header";
import { HigherMathematicsCatalog } from "@/components/higher-mathematics-catalog";
import { PRACTICE_BREADCRUMB } from "@/components/practice-breadcrumb";

export default function HigherMathematicsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[PRACTICE_BREADCRUMB, { label: "Vyšší matematika" }]}
        description="Vyberte tematický okruh. Každý obsahuje nápovědu, kontrolu odpovědi a podrobný postup řešení."
        title="Vyšší matematika"
      />
      <HigherMathematicsCatalog topics={mathTopics} />
    </main>
  );
}
