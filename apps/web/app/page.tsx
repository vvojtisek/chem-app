const modes = [
  {
    title: "Periodická tabulka",
    description: "Procvičování značek, názvů a pozic prvků.",
  },
  {
    title: "Chemické rovnice",
    description: "Vyčíslování a doplňování reaktantů a produktů.",
  },
  {
    title: "Názvosloví",
    description: "Převod mezi českými názvy a chemickými vzorci.",
  },
  {
    title: "Výskyt a výroba",
    description: "Minerály, průmyslové procesy a opakovací karty.",
  },
] as const;

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
            Výukové režimy
          </h2>
          <span className="rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900">
            Příprava MVP
          </span>
        </div>

        <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2">
          {modes.map((mode, index) => (
            <li
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_45px_rgb(15_23_42/0.06)]"
              key={mode.title}
            >
              <span aria-hidden="true" className="text-sm font-semibold text-emerald-700">
                0{index + 1}
              </span>
              <h3 className="mt-6 text-xl font-semibold text-slate-950">{mode.title}</h3>
              <p className="mt-2 leading-7 text-slate-600">{mode.description}</p>
              {mode.title === "Periodická tabulka" ? (
                <Link
                  className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 font-semibold text-white"
                  href="/flashcards/prvky"
                >
                  Otevřít karty prvků
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
import Link from "next/link";
