import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import { curatedElements } from "@inorganic/content/runtime";
import { PracticeNavigation } from "@/components/practice-navigation";
import { ReactionEquationPractice } from "@/components/reaction-equation-practice";

export default function EquationPracticePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-8 sm:px-8">
      <PracticeNavigation backHref="/procvicovani" />
      <header className="mb-6">
        <p className="text-sm font-semibold tracking-[0.16em] text-good uppercase">Procvičování</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Chemické rovnice
        </h1>
      </header>
      <ReactionEquationPractice
        products={curatedPreparationProduction}
        allowedSymbols={curatedElements.map((element) => element.symbol)}
      />
    </main>
  );
}
