import { curatedElements, curatedGroups } from "@inorganic/content/runtime";

import { ElementFlashcards } from "@/components/element-flashcards";
import { PRACTICE_HUB_HREF, PracticeNavigation } from "@/components/practice-navigation";

export default function ElementFlashcardsPage() {
  return (
    <main className="min-h-dvh px-5 py-10 sm:px-8 lg:py-16">
      <PracticeNavigation backHref={PRACTICE_HUB_HREF} />
      <ElementFlashcards curatedElements={curatedElements} groups={curatedGroups} />
    </main>
  );
}
