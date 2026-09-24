import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import Link from "next/link";
import { PracticeNavigation } from "@/components/practice-navigation";

export default function PreparationProductionLearningPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-8 sm:px-8">
      <PracticeNavigation backHref="/uceni/prvky" />
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.16em] text-emerald-800 uppercase">
          Výukový set
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Příprava a výroba látek
        </h1>
        <p className="mt-3 leading-7 text-slate-700">
          Procházejte přípravu a výrobu prvků i sloučenin podle konkrétního produktu. Jde o studijní
          materiál bez otázek a ukládání pokusů. Reakční rovnice pocházejí z e-learningu VŠCHT.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Jedna rovnice pro přípravu azoxidu na zdrojové stránce není atomově vyvážená, proto není
          zařazena do učiva ani procvičování.
        </p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 font-semibold text-white"
          href="/procvicovani/rovnice"
        >
          Procvičit chemické rovnice
        </Link>
      </header>

      <ul className="mt-8 grid list-none gap-3 p-0 md:grid-cols-2">
        {curatedPreparationProduction.map((product) => (
          <li className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" key={product.id}>
            <details>
              <summary className="min-h-11 cursor-pointer list-none rounded-lg py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                {product.nameCs}{" "}
                <span className="font-mono text-slate-700">({product.formula})</span>
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {product.routes.length} rovnic
                </span>
              </summary>
              <div className="mt-3 border-t border-slate-100 pt-3">
                {product.notes.map((note) => (
                  <p className="mb-3 leading-6 text-slate-700" key={`${note.kind}-${note.text}`}>
                    <strong>{note.kind === "preparation" ? "Příprava" : "Výroba"}:</strong>{" "}
                    {note.text}
                  </p>
                ))}
                {product.routes.length > 0 ? (
                  <ol className="grid gap-2">
                    {product.routes.map((route) => (
                      <li className="rounded-xl bg-slate-50 p-3" key={route.id}>
                        <p className="text-sm font-semibold text-slate-700">
                          {route.kind === "preparation" ? "Příprava" : "Výroba"}
                        </p>
                        <p className="mt-1 font-mono text-sm leading-6 text-slate-950">
                          {formatSide(route.reactants)} → {formatSide(route.products)}
                        </p>
                        {route.conditionsCs ? (
                          <p className="mt-1 text-sm text-slate-600">
                            Podmínky nad šipkou: {route.conditionsCs}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-slate-600">
                    Zdroj popisuje výrobu textově, bez reakční rovnice.
                  </p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
      <a
        className="mt-6 inline-block text-sm underline"
        href={curatedPreparationProduction[0]?.sources[0]?.locator}
        rel="noreferrer"
        target="_blank"
      >
        Otevřít původní rejstřík e-learningu VŠCHT
      </a>
    </main>
  );
}

function formatSide(terms: readonly { readonly coefficient: number; readonly formula: string }[]) {
  return terms
    .map(({ coefficient, formula }) => `${coefficient === 1 ? "" : `${coefficient} `}${formula}`)
    .join(" + ");
}
