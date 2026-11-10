import { mathTopics } from "@inorganic/content/higher-mathematics";
import { MathHeader } from "@/components/mathematics/header";
import { MATH_SUBJECT_ID } from "@/components/mathematics/routes";
import { MathSectionCatalog } from "@/components/mathematics/section-catalog";
import { SubjectComingSoon } from "@/components/subject-coming-soon";
import { SubjectHeader } from "@/components/subject-header";

export default async function SubjectPracticePage({
  params,
}: Readonly<{ params: Promise<{ subject: string }> }>) {
  const { subject } = await params;
  if (subject === MATH_SUBJECT_ID) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
        <MathHeader
          area="practice"
          description="Devět okruhů podle sylabu: úlohy s nápovědou, kontrolou odpovědi a postupem řešení."
          title="Matematika: Procvičovat"
        />
        <MathSectionCatalog area="practice" topics={mathTopics} />
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
      <SubjectHeader
        description="Testy a cvičení s hodnocením odpovědí."
        section="Procvičovat"
        subject={subject}
      />
      <SubjectComingSoon subject={subject} title="Testy připravujeme">
        Procvičování s hodnocením odpovědí pro tento předmět zatím není hotové. Do té doby můžete
        úlohy řešit krok za krokem v učivu.
      </SubjectComingSoon>
    </main>
  );
}
