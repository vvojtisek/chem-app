import { SubjectComingSoon } from "@/components/subject-coming-soon";
import { SubjectHeader } from "@/components/subject-header";

export default async function SubjectProgressPage({
  params,
}: Readonly<{ params: Promise<{ subject: string }> }>) {
  const { subject } = await params;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
      <SubjectHeader
        description="Přehled vašich výsledků v tomto předmětu."
        section="Pokrok"
        subject={subject}
      />
      <SubjectComingSoon subject={subject} title="Sledování pokroku připravujeme">
        Řešení úloh se zatím nezaznamenává, proto tu ještě není co zobrazit. Pokrok začneme sledovat
        spolu s testy.
      </SubjectComingSoon>
    </main>
  );
}
