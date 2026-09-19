import { curatedElements, curatedGroups } from "@inorganic/content/runtime";

import { ElementFlashcards } from "@/components/element-flashcards";

export default function ElementFlashcardsPage() {
  return (
    <main className="min-h-dvh px-5 py-10 sm:px-8 lg:py-16">
      <ElementFlashcards curatedElements={curatedElements} groups={curatedGroups} />
    </main>
  );
}
