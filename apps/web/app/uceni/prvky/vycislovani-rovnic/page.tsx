import { curatedBalancingReactionLessons } from "@inorganic/content/balancing-reactions";
import { BalancingReactionsLesson } from "@/components/balancing-reactions-lesson";
import { Breadcrumbs } from "@/components/page-header";

export default function BalancingReactionsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-8">
      <header className="mb-2 grid gap-1">
        <Breadcrumbs
          items={[{ label: "Učivo", href: "/uceni/prvky" }, { label: "Vyčíslování rovnic" }]}
        />
        <h1 className="font-display text-xl font-bold text-ink">Vyčíslování rovnic</h1>
        <p className="text-sm text-ink-2">
          Bilance atomů, náboje a elektronů krok za krokem. Nejde o test.
        </p>
      </header>
      <BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />
    </main>
  );
}
