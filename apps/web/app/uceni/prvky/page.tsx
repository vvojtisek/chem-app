import { curatedElements, curatedGroups } from "@inorganic/content/runtime";
import {
  curatedPreparationProduction,
  type PreparationProductionRuntimeProduct,
} from "@inorganic/content/preparation-production";
import { parseEquationFormula } from "@inorganic/chemistry";
import Link from "next/link";
import { GroupMnemonics } from "@/components/group-mnemonics";
import { PracticeNavigation } from "@/components/practice-navigation";

const numberFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 6 });
const elementSymbols = new Set(curatedElements.map((element) => element.symbol));
const elementProduction = new Map<string, PreparationProductionRuntimeProduct[]>();
for (const product of curatedPreparationProduction) {
  const parsed = parseEquationFormula(product.formula, elementSymbols);
  const [symbol] = parsed ? Object.keys(parsed.atomCounts) : [];
  if (symbol && parsed && Object.keys(parsed.atomCounts).length === 1) {
    elementProduction.set(symbol, [...(elementProduction.get(symbol) ?? []), product]);
  }
}

export default function ElementLearningPage() {
  const groups = Array.from({ length: 18 }, (_, index) => {
    const groupNumber = index + 1;
    return {
      groupNumber,
      groupInfo: curatedGroups.find((group) => group.groupNumber === groupNumber),
      elements: curatedElements.filter((element) => element.group === groupNumber),
    };
  }).filter((group) => group.elements.length > 0);
  const fBlockElements = curatedElements.filter((element) => element.group === null);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 py-8 sm:px-8">
      <PracticeNavigation backHref="/" />
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.16em] text-emerald-800 uppercase">
          Výukový set
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Prvky a jejich skupiny
        </h1>
        <p className="mt-3 leading-7 text-slate-700">
          Procházejte údaje o všech 118 prvcích. Rozbalte prvek pro jeho český a latinský název,
          umístění v tabulce, relativní atomovou hmotnost a valenční konfiguraci. Tato sada slouží k
          učení: neobsahuje otázky ani nezaznamenává pokusy.
        </p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-900"
          href="/uceni/priprava-vyroba"
        >
          Procházet všechny přípravy a výroby
        </Link>
      </header>

      <section aria-labelledby="groups-heading" className="mt-8">
        <h2 className="text-2xl font-semibold" id="groups-heading">
          Přehled skupin
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {groups.map(({ groupNumber, groupInfo, elements }) => (
            <section
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              key={groupNumber}
            >
              <h3 className="text-lg font-semibold">
                {groupInfo?.nameCs ?? `Skupina ${groupNumber}`}
                <span className="ml-2 text-sm font-normal text-slate-600">
                  ({groupNumber}. skupina)
                </span>
              </h3>
              {groupInfo ? <GroupMnemonics group={groupInfo} /> : null}
              <ul className="mt-3 flex flex-wrap gap-2">
                {elements.map((element) => (
                  <li className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm" key={element.id}>
                    <span className="font-semibold">{element.symbol}</span> {element.nameCs}
                  </li>
                ))}
              </ul>
              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {elements.map((element) => (
                  <li className="py-2" key={element.id}>
                    <ElementStudyCard
                      element={element}
                      products={elementProduction.get(element.symbol) ?? []}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-lg font-semibold">f-blok</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Lanthanoidy a aktinoidy jsou uvedeny samostatně, protože nemají číslo skupiny v hlavní
              části tabulky.
            </p>
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {fBlockElements.map((element) => (
                <li className="py-2" key={element.id}>
                  <ElementStudyCard
                    element={element}
                    products={elementProduction.get(element.symbol) ?? []}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}

function ElementStudyCard({
  element,
  products,
}: Readonly<{
  element: (typeof curatedElements)[number];
  products: readonly PreparationProductionRuntimeProduct[];
}>) {
  return (
    <details className="group rounded-lg">
      <summary className="min-h-11 cursor-pointer list-none rounded-lg py-2 font-medium marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
        <span
          aria-hidden="true"
          className="mr-2 inline-block w-8 text-center font-semibold text-emerald-900"
        >
          {element.symbol}
        </span>
        {element.nameCs}
        <span className="ml-2 text-sm text-slate-500">{element.atomicNumber}</span>
        <span aria-hidden="true" className="float-right px-2 text-slate-500 group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <dl className="grid gap-2 pb-3 pl-10 pr-2 text-sm sm:grid-cols-2">
        <StudyFact label="Latinský název" value={element.nameLat} />
        <StudyFact label="Protonové číslo" value={String(element.atomicNumber)} />
        <StudyFact label="Perioda" value={String(element.period)} />
        <StudyFact
          label="Skupina"
          value={element.group === null ? "f-blok" : String(element.group)}
        />
        <StudyFact
          label="Relativní atomová hmotnost"
          value={numberFormatter.format(element.atomicWeight)}
        />
        <StudyFact label="Valenční konfigurace" value={element.valenceConfiguration} />
      </dl>
      {products.map((product) => (
        <section
          aria-label={`Příprava a výroba: ${element.nameCs}`}
          className="pb-3 pl-10 pr-2"
          key={product.id}
        >
          <h3 className="font-semibold">Příprava a výroba {product.nameCs}</h3>
          {product.notes.map((note) => (
            <p className="mt-2 text-sm leading-6 text-slate-700" key={`${note.kind}-${note.text}`}>
              {note.kind === "preparation" ? "Příprava" : "Výroba"}: {note.text}
            </p>
          ))}
          {product.routes.length > 0 ? (
            <ul className="mt-3 grid gap-2 text-sm">
              {product.routes.map((route) => (
                <li className="rounded-lg bg-slate-50 p-3" key={route.id}>
                  <span className="font-medium">
                    {route.kind === "preparation" ? "Příprava" : "Výroba"}: {formatReaction(route)}
                  </span>
                  {route.conditionsCs ? (
                    <span className="ml-2 text-slate-600">({route.conditionsCs} nad šipkou)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <a
            className="mt-3 inline-block underline"
            href={product.sources[0]?.locator}
            rel="noreferrer"
            target="_blank"
          >
            Zdroj: e-learning VŠCHT
          </a>
        </section>
      ))}
    </details>
  );
}

function formatReaction(route: PreparationProductionRuntimeProduct["routes"][number]) {
  const formatSide = (terms: typeof route.reactants) =>
    terms
      .map(({ coefficient, formula }) => `${coefficient === 1 ? "" : `${coefficient} `}${formula}`)
      .join(" + ");
  return `${formatSide(route.reactants)} → ${formatSide(route.products)}`;
}

function StudyFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-950">{value}</dd>
    </div>
  );
}
