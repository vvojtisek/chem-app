import { describe, expect, it } from "vitest";
import {
  evaluateNomenclatureAnswer,
  type NomenclatureAnswerKey,
} from "./evaluate-nomenclature-answer";

const symbols = new Set(["Ag", "Cl", "Cu", "H", "O", "S"]);
const formulaToName: NomenclatureAnswerKey = {
  direction: "formula-to-name",
  formula: "AgCl",
  nameCs: "chlorid stříbrný",
};
const nameToFormula: NomenclatureAnswerKey = {
  direction: "name-to-formula",
  formula: "CuSO4·5H2O",
  nameCs: "pentahydrát síranu měďnatého",
};

describe("evaluateNomenclatureAnswer", () => {
  it("distinguishes strict and tolerant Czech names without suffix guessing", () => {
    expect(
      evaluateNomenclatureAnswer(formulaToName, "CHLORID STŘÍBRNÝ", "strict", symbols),
    ).toEqual({
      isCorrect: true,
      match: "canonical",
    });
    expect(
      evaluateNomenclatureAnswer(formulaToName, "chlorid stribrny", "strict", symbols).isCorrect,
    ).toBe(false);
    expect(
      evaluateNomenclatureAnswer(formulaToName, "chlorid stribrny", "tolerant", symbols),
    ).toEqual({
      isCorrect: true,
      match: "missing-diacritics",
    });
    expect(
      evaluateNomenclatureAnswer(formulaToName, "chlorid stříbrnatý", "tolerant", symbols)
        .isCorrect,
    ).toBe(false);
  });

  it("compares complete hydrate formulas and preserves element case", () => {
    expect(evaluateNomenclatureAnswer(nameToFormula, "CuSO₄.5H₂O", "strict", symbols)).toEqual({
      isCorrect: true,
      match: "canonical",
    });
    expect(
      evaluateNomenclatureAnswer(nameToFormula, "CuSO4·4H2O", "tolerant", symbols).isCorrect,
    ).toBe(false);
    expect(evaluateNomenclatureAnswer(nameToFormula, "CuSO4", "strict", symbols).isCorrect).toBe(
      false,
    );
    expect(
      evaluateNomenclatureAnswer(nameToFormula, "cuso4·5h2o", "tolerant", symbols).isCorrect,
    ).toBe(false);
  });

  it("accepts only explicit direction-specific aliases", () => {
    const withAlias: NomenclatureAnswerKey = {
      direction: "name-to-formula",
      formula: "H2O",
      nameCs: "voda",
      formulaAliases: ["OH2"],
    };
    expect(evaluateNomenclatureAnswer(withAlias, "OH2", "strict", symbols)).toEqual({
      isCorrect: true,
      match: "alias",
    });
    const alternative: NomenclatureAnswerKey = {
      direction: "name-to-formula",
      formula: "H2O2",
      nameCs: "peroxid vodíku",
      formulaAliases: [],
    };
    expect(evaluateNomenclatureAnswer(alternative, "HO", "strict", symbols).isCorrect).toBe(false);
  });
});
