import {
  curatedPreparationProduction,
  type PreparationProductionRuntimeProduct,
} from "@inorganic/content/preparation-production";
import { curatedElements, curatedGroups } from "@inorganic/content/runtime";
import { parseEquationFormula } from "@inorganic/chemistry";
import Link from "next/link";
import { ElementBrowser } from "@/components/element-browser";
import { GroupMnemonics } from "@/components/group-mnemonics";
import { PageHeader } from "@/components/page-header";

const elementSymbols = new Set(curatedElements.map((element) => element.symbol));
/** Products that are a single element, keyed by its symbol (H2 → H, P4 → P). */
const elementProduction: Record<string, PreparationProductionRuntimeProduct[]> = {};
for (const product of curatedPreparationProduction) {
  const parsed = parseEquationFormula(product.formula, elementSymbols);
  const [symbol] = parsed ? Object.keys(parsed.atomCounts) : [];
  if (symbol && parsed && Object.keys(parsed.atomCounts).length === 1) {
    elementProduction[symbol] = [...(elementProduction[symbol] ?? []), product];
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        actions={
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
            href="/uceni/priprava-vyroba"
          >
            Příprava a výroba látek
          </Link>
        }
        description="Najděte prvek podle názvu, značky nebo protonového čísla, nebo zužte výběr podle skupiny a periody. Tato sada slouží k učení: neobsahuje otázky ani nezaznamenává pokusy."
        title="Prvky a jejich skupiny"
      />
      <ElementBrowser
        elements={curatedElements}
        groups={curatedGroups}
        production={elementProduction}
      />

      <details className="group mt-8 rounded-2xl border border-line bg-surface">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 font-display text-lg font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Přehled skupin a mnemotechnické pomůcky
          <span aria-hidden="true" className="text-ink-3 group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="grid gap-4 border-t border-line p-5 md:grid-cols-2">
          {groups.map(({ groupNumber, groupInfo, elements }) => (
            <section aria-labelledby={`group-${groupNumber}-heading`} key={groupNumber}>
              <h3 className="font-semibold text-ink" id={`group-${groupNumber}-heading`}>
                {groupInfo?.nameCs ?? `Skupina ${groupNumber}`}
                <span className="ml-2 text-sm font-normal text-ink-2">
                  ({groupNumber}. skupina)
                </span>
              </h3>
              {groupInfo ? <GroupMnemonics group={groupInfo} /> : null}
              <p className="mt-2 text-sm text-ink-2">
                {elements.map((element) => `${element.symbol} ${element.nameCs}`).join(" · ")}
              </p>
            </section>
          ))}
        </div>
      </details>
    </main>
  );
}
