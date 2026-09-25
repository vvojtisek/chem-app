import { Fragment } from "react";

import { formulaSegments, plainFormula } from "@/lib/formula-display";

interface FormulaProps {
  readonly formula: string;
  readonly charge?: number;
  readonly className?: string;
}

/**
 * A typeset formula with real subscripts and superscripts. Assistive technology reads the
 * plain notation („SO4 2-“) instead of the individual scripts.
 */
export function Formula({ formula, charge = 0, className }: FormulaProps) {
  return (
    <span
      aria-label={plainFormula(formula, charge)}
      className={`whitespace-nowrap ${className ?? ""}`}
      role="img"
    >
      {formulaSegments(formula, charge).map((segment, index) => {
        const key = `${index}-${segment.text}`;
        if (segment.kind === "sub") return <sub key={key}>{segment.text}</sub>;
        if (segment.kind === "sup") return <sup key={key}>{segment.text}</sup>;
        return <Fragment key={key}>{segment.text}</Fragment>;
      })}
    </span>
  );
}

interface EquationTerm {
  readonly formula: string;
  readonly coefficient?: number;
}

/** One side of an equation, „2 HCl + Zn“, with coefficients of 1 left out. */
export function EquationSide({
  terms,
  withCoefficients = true,
}: Readonly<{ terms: readonly EquationTerm[]; withCoefficients?: boolean }>) {
  return (
    <>
      {terms.map((term, index) => (
        // A formula appears once per side of an equation, so it identifies the term.
        <Fragment key={term.formula}>
          {index > 0 ? " + " : null}
          {withCoefficients && term.coefficient !== undefined && term.coefficient !== 1
            ? `${term.coefficient} `
            : null}
          <Formula formula={term.formula} />
        </Fragment>
      ))}
    </>
  );
}

/** A whole equation, reactants → products, as typeset text. */
export function Equation({
  reactants,
  products,
}: Readonly<{ reactants: readonly EquationTerm[]; products: readonly EquationTerm[] }>) {
  return (
    <>
      <EquationSide terms={reactants} /> → <EquationSide terms={products} />
    </>
  );
}
