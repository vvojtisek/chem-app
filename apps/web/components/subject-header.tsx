import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/page-header";

const SUBJECT_ID = /^[a-z][a-z0-9-]{1,31}$/;

/** Display name from the URL id ("matematika" → "Matematika"); 404 for an invalid id. */
export function subjectTitle(subject: string): string {
  if (!SUBJECT_ID.test(subject)) notFound();
  return subject.charAt(0).toUpperCase() + subject.slice(1).replaceAll("-", " ");
}

export function SubjectHeader({
  subject,
  section,
  description,
}: Readonly<{ subject: string; section: string; description: string }>) {
  const title = subjectTitle(subject);
  return (
    <header className="mb-2 grid gap-1">
      <Breadcrumbs items={[{ label: title, href: `/predmety/${subject}` }, { label: section }]} />
      <h1 className="font-display text-xl font-bold text-ink">
        {title}: {section}
      </h1>
      <p className="text-sm text-ink-2">{description}</p>
    </header>
  );
}
