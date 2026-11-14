"use client";

import type { PreparationProductionRuntimeRoute } from "@inorganic/content/preparation-production";
import { Fragment, useId } from "react";

import { Formula } from "@/components/formula";
import { NamedSubstance } from "@/components/question-tools";
import { SegmentedChoice } from "@/components/segmented-choice";
import { czechCount } from "@/lib/czech-plural";
import type { ProductsHint } from "@/lib/practice-hints";
import type { ProductionQuizKind, ProductionQuizOption } from "@/lib/preparation-production-quiz";
import type { ProductionRecallSettings } from "@/lib/production-recall";

/** Pieces shared by the three difficulties of the preparation and production quiz. */

export type Route = PreparationProductionRuntimeRoute;
type Term = Route["reactants"][number];

export const KINDS: readonly ProductionQuizKind[] = ["all", "preparation", "manufacture"];
export const KIND_LABELS = { preparation: "Příprava", manufacture: "Výroba" } as const;
export const ROUTE_KIND_LABELS = {
  preparation: "Laboratorní příprava",
  manufacture: "Průmyslová výroba",
} as const;
export const PRODUCT_FORMS = ["produkt", "produkty", "produktů"] as const;

const QUESTION_FORMS = ["otázka", "otázky", "otázek"] as const;
const KIND_OPTIONS: readonly { readonly kind: ProductionQuizKind; readonly label: string }[] = [
  { kind: "all", label: "Vše" },
  { kind: "preparation", label: "Příprava" },
  { kind: "manufacture", label: "Výroba" },
];
const COUNT_OPTIONS: readonly { readonly value: number | null; readonly label: string }[] = [
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: null, label: "Všechny" },
];

export function QuizSetup({
  description,
  settings,
  available,
  plannedCount,
  onChange,
  onStart,
}: Readonly<{
  description: string;
  settings: ProductionRecallSettings;
  available: Readonly<Record<ProductionQuizKind, number>>;
  plannedCount: number;
  onChange: (settings: ProductionRecallSettings) => void;
  onStart: () => void;
}>) {
  const kindName = useId();
  const countName = useId();
  return (
    <section
      aria-label="Nastavení kvízu"
      className="grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <p className="leading-7 text-ink-2">{description}</p>
      <SegmentedChoice
        legend="Postupy"
        name={kindName}
        onSelect={(kind) => onChange({ ...settings, kind })}
        options={KIND_OPTIONS.map(({ kind, label }) => ({
          value: kind,
          label: `${label} (${available[kind]})`,
        }))}
        value={settings.kind}
      />
      <SegmentedChoice
        legend="Počet otázek"
        name={countName}
        onSelect={(count) => onChange({ ...settings, count })}
        options={COUNT_OPTIONS}
        value={settings.count}
      />
      <div>
        <button
          className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-on-fill hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-3"
          disabled={plannedCount === 0}
          onClick={onStart}
          type="button"
        >
          Spustit kvíz ({czechCount(plannedCount, QUESTION_FORMS)})
        </button>
      </div>
    </section>
  );
}

/** One side of a reaction; coefficients of 1 are left out. */
export function EquationTerms({
  terms,
  withCoefficients = true,
  animate = false,
}: Readonly<{
  terms: readonly { readonly formula: string; readonly coefficient?: number }[];
  withCoefficients?: boolean;
  animate?: boolean;
}>) {
  return (
    <>
      {terms.map((term, index) => (
        // A formula appears once per side of an equation, so it identifies the term.
        <Fragment key={term.formula}>
          {index > 0 ? " + " : null}
          {withCoefficients && term.coefficient !== undefined && term.coefficient !== 1 ? (
            <>
              <Coefficient animate={animate} value={term.coefficient} />{" "}
            </>
          ) : null}
          <Formula formula={term.formula} />
        </Fragment>
      ))}
    </>
  );
}

/** A coefficient; one filled in for the learner is highlighted with a short pop. */
export function Coefficient({ value, animate }: Readonly<{ value: number; animate: boolean }>) {
  return (
    <span
      className={animate ? "reaction-coefficient-active text-accent" : undefined}
      data-coefficient=""
    >
      {value}
    </span>
  );
}

/** The reviewed, balanced reaction. */
export function BalancedEquation({
  route,
  animate = "none",
}: Readonly<{ route: Route; animate?: "none" | "products" | "all" }>) {
  return (
    <span data-balanced-equation="">
      <EquationTerms animate={animate === "all"} terms={route.reactants} /> →{" "}
      <EquationTerms animate={animate !== "none"} terms={route.products} />
    </span>
  );
}

export function Conditions({ route }: Readonly<{ route: Route }>) {
  return route.conditionsCs ? (
    <span className="text-ink-2">; podmínky: {route.conditionsCs}</span>
  ) : null;
}

export function ByproductHintText({ hint }: Readonly<{ hint: ProductsHint }>) {
  if (hint.productCount <= 1) return <>Vzniká jediný produkt.</>;
  return (
    <>
      Vznikají {czechCount(hint.productCount, PRODUCT_FORMS)}.
      {hint.product ? (
        <>
          {" "}
          Jedním z nich je <NamedSubstance {...hint.product} />.
        </>
      ) : null}
    </>
  );
}

/** What the summary lists for a question whose first answer was not correct. */
export interface MissedQuestion {
  readonly id: string;
  readonly kind: Route["kind"];
  readonly product: ProductionQuizOption;
  readonly routes: readonly Route[];
}

export function MissedList({ missed }: Readonly<{ missed: readonly MissedQuestion[] }>) {
  return (
    <section className="mt-5 border-t border-line pt-4">
      <h3 className="font-semibold text-ink">K zopakování</h3>
      <ul className="mt-2 grid list-none gap-2 p-0">
        {missed.map((item) => (
          <li className="rounded-xl bg-surface-2 p-3 text-sm leading-6" key={item.id}>
            <span className="font-semibold text-ink">
              {item.product.nameCs} (<Formula formula={item.product.formula} />)
            </span>{" "}
            <span className="text-ink-3">· {KIND_LABELS[item.kind]}</span>
            {item.routes.map((route) => (
              <span className="block text-ink-2" key={route.id}>
                <BalancedEquation route={route} />
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

export type { Term };
