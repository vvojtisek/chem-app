import { PracticeCategoryList } from "@/components/practice-category-list";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-5 sm:px-8 lg:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          Anorganická chemie
        </h1>
      </header>

      <section aria-label="Režimy procvičování" className="mt-4">
        <PracticeCategoryList />
      </section>
    </main>
  );
}
