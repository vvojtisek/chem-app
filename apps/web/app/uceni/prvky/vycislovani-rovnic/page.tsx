import { curatedBalancingReactionLessons } from "@inorganic/content/balancing-reactions";
import { BalancingReactionsLesson } from "@/components/balancing-reactions-lesson";
import { PageHeader } from "@/components/page-header";

export default function BalancingReactionsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[{ label: "Učivo", href: "/uceni/prvky" }, { label: "Vyčíslování rovnic" }]}
        description="Výukový průvodce vede krok za krokem k bilanci atomů, náboje a elektronů. Nejde o test a průchod se nehodnotí."
        title="Vyčíslování rovnic"
      />
      <BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />
    </main>
  );
}
