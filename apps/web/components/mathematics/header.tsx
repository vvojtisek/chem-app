import { Breadcrumbs } from "@/components/page-header";
import { MATH_LEARN_PATH, MATH_PRACTICE_PATH, type MathArea } from "./routes";

const AREA_LABEL: Readonly<Record<MathArea, string>> = { learn: "Učivo", practice: "Procvičovat" };
const AREA_PATH: Readonly<Record<MathArea, string>> = {
  learn: MATH_LEARN_PATH,
  practice: MATH_PRACTICE_PATH,
};

/** Same header typography as SubjectHeader on /predmety/matematika. */
export function MathHeader({
  area,
  title,
  description,
  sectionLabel,
}: Readonly<{ area: MathArea; title: string; description: string; sectionLabel?: string }>) {
  const breadcrumbs = sectionLabel
    ? [
        { label: "Matematika", href: MATH_LEARN_PATH },
        { label: AREA_LABEL[area], href: AREA_PATH[area] },
        { label: sectionLabel },
      ]
    : [{ label: "Matematika", href: MATH_LEARN_PATH }, { label: AREA_LABEL[area] }];
  return (
    <header className="mb-2 grid gap-1">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
      <p className="text-sm text-ink-2">{description}</p>
    </header>
  );
}
