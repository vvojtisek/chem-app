import { describe, expect, it } from "vitest";

import { listFormulaElements } from "./formula-elements";

const symbols = new Set([
  "Ag",
  "Al",
  "C",
  "Ca",
  "Cl",
  "Cu",
  "F",
  "H",
  "K",
  "N",
  "Na",
  "Ni",
  "O",
  "S",
  "Si",
]);

describe("listFormulaElements", () => {
  it.each([
    ["Ag", ["Ag"]],
    ["O2", ["O"]],
    ["NaCl", ["Na", "Cl"]],
    ["CaCO3", ["Ca", "C", "O"]],
    ["Al(OH)3", ["Al", "O", "H"]],
    ["[Al(H2O)6]Cl3", ["Al", "H", "O", "Cl"]],
    ["K[Ag(CN)2]", ["K", "Ag", "C", "N"]],
    ["[(Na2O)(CaO)(SiO2)6]", ["Na", "O", "Ca", "Si"]],
    ["CuSO4·5H2O", ["Cu", "S", "O", "H"]],
    ["[Ni(CO)4]", ["Ni", "C", "O"]],
  ] as const)("lists the distinct elements of %s", (formula, expected) => {
    expect(listFormulaElements(formula, symbols)).toEqual(expected);
  });

  it.each([
    ["P(OR)3", "an unknown symbol"],
    ["Nacl", "a lowercase letter outside a symbol"],
    ["SO4 2-", "a charge written into the formula"],
    ["NaCl+", "a charge sign"],
    ["", "an empty formula"],
    ["2H2O", "a leading coefficient"],
  ])("rejects %j (%s)", (formula) => {
    expect(listFormulaElements(formula, symbols)).toBeNull();
  });
});
