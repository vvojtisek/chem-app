import { SubjectHeader } from "@/components/subject-header";
import { SubjectWorkspace } from "@/components/subject-workspace";

/**
 * Učivo of every registered subject module (ADR 0015). The subject list,
 * problem types and fields come from the API, so a new subject needs no page.
 */
export default async function SubjectPage({
  params,
}: Readonly<{ params: Promise<{ subject: string }> }>) {
  const { subject } = await params;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
      <SubjectHeader
        description="Řešení krok za krokem s ověřením výsledku. Nejde o test."
        section="Učivo"
        subject={subject}
      />
      <SubjectWorkspace subjectId={subject} />
    </main>
  );
}
