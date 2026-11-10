import { mathTopics } from "@inorganic/content/higher-mathematics";
import { MathHeader } from "@/components/mathematics/header";
import { MATH_SUBJECT_ID } from "@/components/mathematics/routes";
import { MathSectionCatalog } from "@/components/mathematics/section-catalog";
import { SubjectHeader } from "@/components/subject-header";
import { SubjectWorkspace } from "@/components/subject-workspace";

/**
 * Učivo of every registered subject module (ADR 0015). The subject list,
 * problem types and fields come from the API, so a new subject needs no page.
 * Mathematics groups its solver under the nine syllabus sections.
 */
export default async function SubjectPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ typ?: string | string[] }>;
}>) {
  const { subject } = await params;
  if (subject === MATH_SUBJECT_ID) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
        <MathHeader
          area="learn"
          description="Devět okruhů podle sylabu. Výklad a řešení krok za krokem s ověřením výsledku."
          title="Matematika: Učivo"
        />
        <MathSectionCatalog area="learn" topics={mathTopics} />
      </main>
    );
  }
  const { typ } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
      <SubjectHeader
        description="Řešení krok za krokem s ověřením výsledku. Nejde o test."
        section="Učivo"
        subject={subject}
      />
      <SubjectWorkspace
        initialTypeId={typeof typ === "string" ? typ : undefined}
        key={typeof typ === "string" ? typ : ""}
        subjectId={subject}
      />
    </main>
  );
}
