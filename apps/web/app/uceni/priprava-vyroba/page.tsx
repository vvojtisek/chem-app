import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import Link from "next/link";
import { PracticeNavigation } from "@/components/practice-navigation";

export default function PreparationProductionLearningPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-8 sm:px-8">
      <PracticeNavigation backHref="/uceni/prvky" />
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.16em] text-good uppercase">Výukový set</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Příprava a výroba látek
        </h1>
        <p className="mt-3 leading-7 text-ink-2">
          Procházejte přípravu a výrobu prvků i sloučenin podle konkrétního produktu. Jde o studijní
          materiál bez otázek a ukládání pokusů. Reakční rovnice pocházejí z e-learningu VŠCHT.
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          Jedna rovnice pro přípravu azoxidu na zdrojové stránce není atomově vyvážená, proto není
          zařazena do učiva ani procvičování.
        </p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-semibold text-on-fill"
          href="/procvicovani/rovnice"
        >
          Procvičit chemické rovnice
        </Link>
      </header>

      <ul className="mt-8 grid list-none gap-3 p-0 md:grid-cols-2">
        {curatedPreparationProduction.map((product) => (
          <li className="rounded-2xl border border-line bg-surface p-4 sm:p-5" key={product.id}>
            <details>
              <summary className="min-h-11 cursor-pointer list-none rounded-lg py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                {product.nameCs} <span className="font-mono text-ink-2">({product.formula})</span>
                <span className="ml-2 text-sm font-normal text-ink-3">
                  {product.routes.length} rovnic
                </span>
              </summary>
              <div className="mt-3 border-t border-line pt-3">
                {product.notes.map((note) => (
                  <p className="mb-3 leading-6 text-ink-2" key={`${note.kind}-${note.text}`}>
                    <strong>{note.kind === "preparation" ? "Příprava" : "Výroba"}:</strong>{" "}
                    {note.text}
                  </p>
                ))}
                {product.routes.length > 0 ? (
                  <ol className="grid gap-2">
                    {product.routes.map((route) => (
                      <li className="rounded-xl bg-surface-2 p-3" key={route.id}>
                        <p className="text-sm font-semibold text-ink-2">
                          {route.kind === "preparation" ? "Příprava" : "Výroba"}
                        </p>
                        <p className="mt-1 font-mono text-sm leading-6 text-ink">
                          {formatSide(route.reactants)} → {formatSide(route.products)}
                        </p>
                        {route.conditionsCs ? (
                          <p className="mt-1 text-sm text-ink-2">
                            Podmínky nad šipkou: {route.conditionsCs}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-ink-2">
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
