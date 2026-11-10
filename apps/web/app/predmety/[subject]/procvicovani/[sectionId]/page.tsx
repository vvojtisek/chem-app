import { notFound } from "next/navigation";

import { mathTopics } from "@inorganic/content/higher-mathematics";
import { MathPracticeHeader } from "@/components/mathematics/practice-header";
import { MathPracticeSession } from "@/components/mathematics/practice-session";
import { MATH_SUBJECT_ID } from "@/components/mathematics/routes";
import { MathSectionNav } from "@/components/mathematics/section-nav";
import { MathTheory } from "@/components/mathematics/theory";
import workspace from "@/components/subject-workspace.module.css";

export function generateStaticParams() {
  return mathTopics.map((topic) => ({ subject: MATH_SUBJECT_ID, sectionId: topic.id }));
}

/** One mathematics section: theory first, then its exercises. */
export default async function MathSectionPage({
  params,
}: Readonly<{ params: Promise<{ subject: string; sectionId: string }> }>) {
  const { subject, sectionId } = await params;
  if (subject !== MATH_SUBJECT_ID) notFound();
  const topic = mathTopics.find((candidate) => candidate.id === sectionId);
  if (!topic) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
      <MathPracticeHeader
        description={topic.description}
        sectionLabel={`${topic.number}. ${topic.shortTitle}`}
        title={`${topic.number}. ${topic.title}`}
      />
      <div className={workspace.workspace}>
        <MathSectionNav currentId={topic.id} topics={mathTopics} />
        <MathTheory topic={topic} />
        <MathPracticeSession key={topic.id} topic={topic} />
      </div>
    </main>
  );
}
