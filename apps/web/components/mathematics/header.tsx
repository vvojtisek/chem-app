import { Breadcrumbs } from "@/components/page-header";
import { MATH_LEARN_PATH, MATH_PRACTICE_PATH } from "./routes";

/** Same header typography as SubjectHeader on /predmety/matematika. */
export function MathPracticeHeader({
  title,
  description,
  sectionLabel,
}: Readonly<{ title: string; description: string; sectionLabel?: string }>) {
  const breadcrumbs = sectionLabel
    ? [
        { label: "Matematika", href: MATH_LEARN_PATH },
        { label: "Procvičovat", href: MATH_PRACTICE_PATH },
        { label: sectionLabel },
      ]
    : [{ label: "Matematika", href: MATH_LEARN_PATH }, { label: "Procvičovat" }];
  return (
    <header className="mb-2 grid gap-1">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
      <p className="text-sm text-ink-2">{description}</p>
    </header>
  );
}
