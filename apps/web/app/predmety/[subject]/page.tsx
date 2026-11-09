import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/page-header";
import { SubjectWorkspace } from "@/components/subject-workspace";

const SUBJECT_ID = /^[a-z][a-z0-9-]{1,31}$/;

/**
 * One route for every registered subject module (ADR 0015). The subject list,
 * problem types and fields come from the API, so a new subject needs no page.
 */
export default async function SubjectPage({
  params,
}: Readonly<{ params: Promise<{ subject: string }> }>) {
  const { subject } = await params;
  if (!SUBJECT_ID.test(subject)) notFound();
  const title = subject.charAt(0).toUpperCase() + subject.slice(1).replaceAll("-", " ");
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
      <header className="mb-2 grid gap-1">
        <Breadcrumbs items={[{ label: "Učivo", href: "/uceni/prvky" }, { label: title }]} />
        <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
        <p className="text-sm text-ink-2">
          Řešení krok za krokem s ověřením výsledku. Nejde o test.
        </p>
      </header>
      <SubjectWorkspace subjectId={subject} />
    </main>
  );
}
