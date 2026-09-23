import {
  curatedElements,
  curatedNomenclature,
  nomenclatureContentVersion,
} from "@inorganic/content/runtime";
import { NomenclaturePractice } from "@/components/nomenclature-practice";

export default function NomenclaturePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-16">
      <p className="text-sm font-semibold tracking-[0.16em] text-emerald-800 uppercase">
        Procvičování
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Názvosloví
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">
        Převádějte vzorce na české názvy a názvy na vzorce. Chyby se na konci série jednou zopakují.
      </p>
      <div className="mt-8">
        <NomenclaturePractice
          compounds={curatedNomenclature}
          contentVersion={nomenclatureContentVersion}
          elementSymbols={curatedElements.map((element) => element.symbol)}
        />
      </div>
    </main>
  );
}
