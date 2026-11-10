import { PageHeader } from "@/components/page-header";
import { PracticeCategoryList } from "@/components/practice-category-list";

export default function PracticeHubPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        description="Vyberte oblast a cvičení. Pokusy se ukládají i bez připojení."
        title="Procvičovat"
      />
      <PracticeCategoryList />
    </main>
  );
}
