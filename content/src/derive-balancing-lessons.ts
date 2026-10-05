import {
  balancingConstraintEquation,
  deriveBalancing,
  parseEquationFormula,
} from "@inorganic/chemistry";
import type {
  BalancingReactionLesson,
  InteractiveStep,
  ReactionSpecies,
} from "./balancing-reactions-schema";

const key = (s: ReactionSpecies) =>
  `${s.formula}${s.charge ? `^${Math.abs(s.charge) === 1 ? "" : Math.abs(s.charge)}${s.charge > 0 ? "+" : "-"}` : ""}`;

export function makeDerivationStep(
  species: readonly ReactionSpecies[],
  split: number,
  coefficients: readonly number[],
  symbols: ReadonlySet<string>,
  title: string,
  explanation: string,
  changes: readonly number[] = [],
): InteractiveStep {
  const terms = species.map((s, i) => ({ ...s, coefficient: coefficients[i] ?? 1 }));
  const reactants = terms.slice(0, split);
  const products = terms.slice(split);
  const count = (side: readonly ReactionSpecies[]) => {
    const totals: Record<string, number> = {};
    for (const s of side) {
      const parsed = parseEquationFormula(s.formula, symbols);
      if (!parsed) throw new Error(`Invalid ${s.formula}`);
      for (const [element, n] of Object.entries(parsed.atomCounts))
        totals[element] = (totals[element] ?? 0) + s.coefficient * n;
    }
    return totals;
  };
  const left = count(reactants);
  const right = count(products);
  const sideText = (side: readonly ReactionSpecies[]) =>
    side.map((s) => `${s.coefficient} ${key(s)}`).join(" + ");
  const changedKeys = changes.map((i) => {
    const term = terms[i];
    if (!term) throw new Error("Invalid changed species index");
    return key(term);
  });
  return {
    stepIndex: 1,
    title,
    explanation,
    focusedSpecies: changedKeys,
    coefficientChanges: changedKeys,
    currentEquationLaTeX: `${sideText(reactants)} -> ${sideText(products)}`,
    equation: { reactants, products },
    balanceLedger: {
      atoms: [...new Set([...Object.keys(left), ...Object.keys(right)])].map((element) => ({
        element,
        reactants: left[element] ?? 0,
        products: right[element] ?? 0,
      })),
      ...(species.some((s) => s.charge !== 0)
        ? {
            charge: {
              reactants: reactants.reduce((n, s) => n + s.charge * s.coefficient, 0),
              products: products.reduce((n, s) => n + s.charge * s.coefficient, 0),
            },
          }
        : {}),
    },
  };
}

/** Offline authoring adapter: persists verified arithmetic; never derives in React. */
export function deriveLessonSteps(
  lesson: BalancingReactionLesson,
  symbols: ReadonlySet<string>,
): InteractiveStep[] {
  const final = lesson.steps.at(-1);
  if (!final) throw new Error(`Missing final ${lesson.id}`);
  const species = [...final.equation.reactants, ...final.equation.products];
  const split = final.equation.reactants.length;
  const result = deriveBalancing(
    final.equation.reactants,
    final.equation.products,
    symbols,
    lesson.derivationConstraints,
  );
  if (!result.ok)
    throw new Error(
      `${lesson.id}: ${result.reason}; an authored constraint is required, not a saved answer`,
    );
  if (result.coefficients.some((c, i) => c !== species[i]?.coefficient))
    throw new Error(`${lesson.id}: derived answer disagrees with source`);
  const coefficients = species.map(() => 1);
  const step = (title: string, explanation: string, changes: number[] = []) =>
    makeDerivationStep(species, split, coefficients, symbols, title, explanation, changes);
  const steps = [
    step(
      "Spočítejte atomy a náboj",
      `Koeficienty začínají na 1. Nejdříve zapíšeme bilance prvků mimo H a O, přednost mají prvky v jedné látce na každé straně; H/O a zápis vody ponecháme na konec. ${species.map((s, i) => `c${i + 1}: ${key(s)}`).join("; ")}.`,
    ),
  ];
  for (const constraint of result.constraints) {
    const left = constraint.values.filter((v) => v > 0).length;
    const right = constraint.values.filter((v) => v < 0).length;
    const why =
      constraint.label === "Náboj"
        ? "Náboj je samostatná podmínka: součet koeficient × náboj vlevo musí být roven součtu vpravo; samotné atomy nestačí."
        : constraint.label === "H" || constraint.label === "O"
          ? "H/O uzavíráme po ostatních prvcích; voda závisí na jejich odvozených poměrech."
          : left === 1 && right === 1
            ? `${constraint.label} je v jedné látce vlevo i vpravo, proto má přednost před rozdělenými prvky a vodou.`
            : `${constraint.label} je rozdělen mezi ${left} látek vlevo a ${right} vpravo; sečteme všechny příspěvky, aby se neztratil žádný atom.`;
    const extra = lesson.derivationConstraints?.find((c) => c.label === constraint.label);
    const lcm =
      left === 1 && right === 1 && constraint.label !== "Náboj"
        ? (() => {
            const a = constraint.values.find((v) => v > 0);
            const negative = constraint.values.find((v) => v < 0);
            if (a === undefined || negative === undefined)
              throw new Error("Invalid pair constraint");
            const b = -negative;
            const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
            const common = (a / gcd(a, b)) * b;
            return ` NSN(${a}, ${b}) = ${common}: dílčí poměr ${common} / ${a} : ${common} / ${b} = ${common / a} : ${common / b}; další bilance mohou vyžadovat společné násobení.`;
          })()
        : "";
    steps.push(
      step(
        `Bilance: ${constraint.label}`,
        `${extra?.explanation ?? why} ${constraint.label}: ${balancingConstraintEquation(constraint.values)}.${lcm}`,
      ),
    );
  }
  for (const operation of result.operations)
    steps.push(
      step(
        `Dosazení: ${operation.label}`,
        `${operation.label}: ${operation.before}. ${operation.arithmetic} Výsledek: ${operation.after}. Obě strany upravujeme stejně; propojené bilance tak určují poměr, nikoli odhad.`,
      ),
    );
  steps.push(
    step(
      "Odvozený celočíselný poměr",
      `Volíme c${result.freeVariable + 1} = 1 pouze jako měřítko. Ze soustavy vychází ${result.ratios.map((r, i) => `c${i + 1} = ${r}`).join("; ")}. NSN jmenovatelů = ${result.multiplier}; společným násobením získáme ${result.coefficients.join(" : ")}. Vodu zapíšeme až po ostatních látkách.`,
    ),
  );
  const order = species
    .map((s, i) => ({ s, i }))
    .sort((a, b) => Number(a.s.formula === "H2O") - Number(b.s.formula === "H2O"));
  for (const { s, i } of order) {
    coefficients[i] = result.coefficients[i] ?? 1;
    const affected = result.constraints
      .filter((c) => c.values[i] !== 0)
      .map((c) => c.label)
      .join(", ");
    steps.push(
      step(
        s.formula === "H2O" ? "Voda uzavírá bilanci" : `Zapište odvozený poměr: ${key(s)}`,
        `Z již odvozených bilancí ${affected}: c${i + 1} = ${result.ratios[i]} × ${result.multiplier} = ${coefficients[i]}. ${s.formula === "H2O" ? "Ostatní koeficienty jsou pevné; tímto počtem vod uzavřeme současně H i O." : "Koeficient je důsledkem uvedených rovností; společné měřítko platí pro všechny látky."}`,
        [i],
      ),
    );
  }
  const totals = step(
    "Závěrečné shrnutí",
    `${final.balanceLedger?.atoms?.map((a) => `${a.element}: ${a.reactants} = ${a.products}`).join("; ")}. ${final.balanceLedger?.charge ? `Náboj: ${final.balanceLedger.charge.reactants} = ${final.balanceLedger.charge.products}. ` : ""}Počty atomů${species.some((s) => s.charge) ? " i součet nábojů" : ""} souhlasí; zákon zachování hmotnosti je splněn.`,
  );
  steps.push({
    ...totals,
    kind: "summary",
    ruleHighlight:
      "Zkontrolujte všechny prvky i náboj; koeficienty mají nejmenší celočíselný poměr.",
  });
  return steps.map((s, i) => ({ ...s, stepIndex: i + 1 }));
}
