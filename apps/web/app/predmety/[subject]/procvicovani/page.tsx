import { mathTopics } from "@inorganic/content/higher-mathematics";
import { MathPracticeCatalog } from "@/components/mathematics/practice-catalog";
import { MathPracticeHeader } from "@/components/mathematics/practice-header";
import { MATH_SUBJECT_ID } from "@/components/mathematics/routes";
import { SubjectComingSoon } from "@/components/subject-coming-soon";
import { SubjectHeader } from "@/components/subject-header";

export default async function SubjectPracticePage({
  params,
}: Readonly<{ params: Promise<{ subject: string }> }>) {
  const { subject } = await params;
  if (subject === MATH_SUBJECT_ID) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
        <MathPracticeHeader
          description="Devět okruhů podle sylabu: výklad, úlohy s nápovědou a postup řešení."
          title="Matematika: Procvičovat"
        />
        <MathPracticeCatalog topics={mathTopics} />
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
