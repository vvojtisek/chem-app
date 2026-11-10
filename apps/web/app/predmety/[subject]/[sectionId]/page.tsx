import Link from "next/link";
import { notFound } from "next/navigation";

import { mathTopics } from "@inorganic/content/higher-mathematics";
import { MathHeader } from "@/components/mathematics/header";
import styles from "@/components/mathematics/practice.module.css";
import { MATH_SUBJECT_ID, mathSectionPath } from "@/components/mathematics/routes";
import { MathSectionNav } from "@/components/mathematics/section-nav";
import { MathTheory } from "@/components/mathematics/theory";
import { SubjectWorkspace } from "@/components/subject-workspace";
import workspace from "@/components/subject-workspace.module.css";

export function generateStaticParams() {
  return mathTopics.map((topic) => ({ subject: MATH_SUBJECT_ID, sectionId: topic.id }));
}

/** Učivo of one mathematics section: theory, then the solver for its problem types. */
export default async function MathLearnSectionPage({
  params,
}: Readonly<{ params: Promise<{ subject: string; sectionId: string }> }>) {
  const { subject, sectionId } = await params;
  if (subject !== MATH_SUBJECT_ID) notFound();
  const topic = mathTopics.find((candidate) => candidate.id === sectionId);
  if (!topic) notFound();

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-2 sm:px-8">
      <MathHeader
        area="learn"
        description={topic.description}
        sectionLabel={`${topic.number}. ${topic.shortTitle}`}
        title={`${topic.number}. ${topic.title}`}
      />
      <div className={workspace.workspace}>
        <MathSectionNav area="learn" currentId={topic.id} topics={mathTopics} />
        <MathTheory topic={topic} />
      </div>
      {topic.solverTypes.length > 0 ? (
        <section aria-labelledby="math-solver-title" className="grid gap-2">
          <h2 className="font-display text-lg font-bold text-ink" id="math-solver-title">
            Vlastní příklad krok za krokem
          </h2>
          <SubjectWorkspace problemTypeIds={topic.solverTypes} subjectId={MATH_SUBJECT_ID} />
        </section>
      ) : null}
      <div className={workspace.workspace}>
        <div className={workspace.actions}>
          <Link
            className={`${workspace.primaryButton} inline-flex items-center`}
            href={mathSectionPath(topic.id)}
          >
            Procvičit {topic.exercises.length} úloh s řešením
          </Link>
          <span className={styles.sectionMeta}>
            Nápověda, kontrola odpovědi a postup řešení krok za krokem.
          </span>
        </div>
      </div>
    </main>
  );
}
