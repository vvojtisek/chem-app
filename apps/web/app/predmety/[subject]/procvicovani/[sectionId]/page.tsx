import Link from "next/link";
import { notFound } from "next/navigation";

import { mathTopics } from "@inorganic/content/higher-mathematics";
import { MathHeader } from "@/components/mathematics/header";
import { MathPracticeSession } from "@/components/mathematics/practice-session";
import { MATH_SUBJECT_ID, mathLearnPath } from "@/components/mathematics/routes";
import { MathSectionNav } from "@/components/mathematics/section-nav";
import { MathTheory } from "@/components/mathematics/theory";
import styles from "@/components/mathematics/practice.module.css";
import workspace from "@/components/subject-workspace.module.css";

export function generateStaticParams() {
  return mathTopics.map((topic) => ({ subject: MATH_SUBJECT_ID, sectionId: topic.id }));
}

/** Procvičovat of one mathematics section: collapsed theory, then its exercises. */
export default async function MathSectionPage({
  params,
}: Readonly<{ params: Promise<{ subject: string; sectionId: string }> }>) {
  const { subject, sectionId } = await params;
  if (subject !== MATH_SUBJECT_ID) notFound();
  const topic = mathTopics.find((candidate) => candidate.id === sectionId);
  if (!topic) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
      <MathHeader
        area="practice"
        description={topic.description}
        sectionLabel={`${topic.number}. ${topic.shortTitle}`}
        title={`${topic.number}. ${topic.title}`}
      />
      <div className={workspace.workspace}>
        <MathSectionNav area="practice" currentId={topic.id} topics={mathTopics} />
        <details className={workspace.card}>
          <summary className={`${workspace.cardTitle} cursor-pointer`}>Výklad k okruhu</summary>
          <MathTheory topic={topic} />
          <Link className={styles.linkButton} href={mathLearnPath(topic.id)}>
            Otevřít okruh v učivu s řešičem
          </Link>
        </details>
        <MathPracticeSession key={topic.id} topic={topic} />
      </div>
    </main>
  );
}
