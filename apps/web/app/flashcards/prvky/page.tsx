import { curatedElements } from "@inorganic/content/runtime";

import { ElementFlashcardPractice } from "@/components/element-flashcard-practice";
import { Breadcrumbs } from "@/components/page-header";
import { PRACTICE_BREADCRUMB } from "@/components/practice-breadcrumb";

export default function ElementFlashcardsPage() {
  return (
    <main className="w-full px-4 py-6 sm:px-8 lg:py-10">
      <div className="mx-auto mb-4 w-full max-w-5xl">
        <Breadcrumbs items={[PRACTICE_BREADCRUMB, { label: "Karty prvků" }]} />
      </div>
      <ElementFlashcardPractice elements={curatedElements} />
    </main>
  );
}
