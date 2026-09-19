import { curatedElements } from "@inorganic/content/runtime";

import { ElementNamePractice } from "@/components/element-name-practice";

export default function ElementPracticePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-16">
      <p className="text-sm font-semibold tracking-[0.16em] text-emerald-800 uppercase">
        Procvičování
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        České názvy prvků
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">
        Napište český název podle značky. Chybné odpovědi dostanou jeden opakovací pokus na konci
        cvičení.
      </p>
      <div className="mt-8">
        <ElementNamePractice elements={curatedElements} />
      </div>
    </main>
  );
}
