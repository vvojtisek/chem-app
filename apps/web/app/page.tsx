import { PracticeCategoryList } from "@/components/practice-category-list";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-10 sm:px-8 lg:py-16">
      <header className="max-w-3xl">
        <p className="mb-4 text-sm font-semibold tracking-[0.18em] text-emerald-800 uppercase">
          Offline výuka
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
          Anorganická chemie bez zbytečného memorování naslepo.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Základ aplikace je připravený. Jednotlivé režimy budou přibývat jako samostatné,
          ověřitelné výukové celky a zůstanou dostupné i bez připojení.
        </p>
      </header>

      <section aria-labelledby="learning-modes" className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <h2 id="learning-modes" className="text-2xl font-semibold text-slate-950">
            Vyberte, co chcete trénovat
          </h2>
          <span className="rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900">
            Příprava MVP
          </span>
        </div>

        <PracticeCategoryList />
      </section>
    </main>
  );
}
