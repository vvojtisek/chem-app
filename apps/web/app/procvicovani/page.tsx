import { PracticeCategoryList } from "@/components/practice-category-list";
import { PracticeNavigation } from "@/components/practice-navigation";

export default function PracticeHubPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-16">
      <PracticeNavigation />
      <p className="text-sm font-semibold tracking-[0.16em] text-emerald-800 uppercase">
        Procvičování
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Vyberte kategorii
      </h1>
      <PracticeCategoryList />
    </main>
  );
}
