import {
  curatedElements,
  curatedNomenclature,
  nomenclatureContentVersion,
} from "@inorganic/content/runtime";
import { NomenclaturePractice } from "@/components/nomenclature-practice";
import { PRACTICE_HUB_HREF, PracticeNavigation } from "@/components/practice-navigation";

export default function NomenclaturePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-5 py-10 sm:px-8 lg:py-16">
      <PracticeNavigation backHref={PRACTICE_HUB_HREF} />
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        Procvičování: Názvosloví
      </h1>
      <div className="mt-6">
        <NomenclaturePractice
          compounds={curatedNomenclature}
          contentVersion={nomenclatureContentVersion}
          elementSymbols={curatedElements.map((element) => element.symbol)}
        />
      </div>
    </main>
  );
}
