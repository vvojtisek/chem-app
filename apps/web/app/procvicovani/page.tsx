import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { PracticeCategoryList } from "@/components/practice-category-list";

export default function PracticeHubPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        description="Vyberte oblast a cvičení. Pokusy se ukládají i bez připojení."
        title="Procvičovat"
      />
      <PracticeCategoryList />
      <section className="mt-10" aria-labelledby="math-practice-title">
        <Link
          className="flex min-h-28 flex-col justify-center rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="/procvicovani/matematika"
        >
          <h2 className="font-display text-xl font-bold text-ink" id="math-practice-title">
            Vyšší matematika
          </h2>
          <p className="mt-1 text-ink-2">
            Devět okruhů analýzy, integrálů a diferenciálních rovnic.
          </p>
        </Link>
      </section>
    </main>
  );
}
