import { curatedElements, curatedGroups } from "@inorganic/content/runtime";

import { ElementFlashcards } from "@/components/element-flashcards";
import { Breadcrumbs } from "@/components/page-header";

export default function ElementCardLearningPage() {
  return (
    <main className="w-full px-4 py-6 sm:px-8 lg:py-10">
      <div className="mx-auto mb-4 w-full max-w-5xl">
        <Breadcrumbs items={[{ label: "Učivo", href: "/uceni/prvky" }, { label: "Karty prvků" }]} />
      </div>
      <ElementFlashcards curatedElements={curatedElements} groups={curatedGroups} />
    </main>
  );
}
