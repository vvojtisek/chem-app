import { describe, expect, it } from "vitest";
import type { NomenclatureRuntimeRecord } from "@inorganic/content/nomenclature-schema";
import { selectNomenclatureQuestions, type NomenclatureSettings } from "./nomenclature-session";

const sulfate: NomenclatureRuntimeRecord = {
  id: "nomenclature.fixture-sulfate",
  reviewLevel: "sme-reviewed",
  formula: "CuSO4·5H2O",
  nameCs: "pentahydrát síranu měďnatého",
  explanationCs: "Fixture explanation.",
  baseCategory: "oxoacid-salt",
  tags: ["hydrate"],
  difficulty: "advanced",
  contextCs: null,
  directions: ["formula-to-name", "name-to-formula"],
  nameAliases: [],
  formulaAliases: [],
};
const chloride: NomenclatureRuntimeRecord = {
  ...sulfate,
  id: "nomenclature.fixture-chloride",
  formula: "AgCl",
  nameCs: "chlorid stříbrný",
  baseCategory: "binary-salt",
  tags: [],
  difficulty: "basic",
  directions: ["formula-to-name"],
};
const settings: NomenclatureSettings = {
  categories: ["oxoacid-salt", "hydrate", "binary-salt"],
  difficulties: ["basic", "advanced"],
  direction: "formula-to-name",
  namePolicy: "strict",
  length: "all",
};

describe("nomenclature question selection", () => {
  it("unions categories, deduplicates hydrates, and remains seeded", () => {
    const first = selectNomenclatureQuestions([sulfate, chloride], settings, 44);
    const reordered = selectNomenclatureQuestions([chloride, sulfate], settings, 44);
    expect(first).toEqual(reordered);
    expect(first).toHaveLength(2);
    expect(new Set(first.map((question) => question.questionId)).size).toBe(2);
  });

  it("intersects direction and difficulty and handles empty filters", () => {
    expect(
      selectNomenclatureQuestions(
        [sulfate, chloride],
        {
          ...settings,
          direction: "name-to-formula",
          difficulties: ["advanced"],
        },
        0,
      ).map((question) => question.id),
    ).toEqual([sulfate.id]);
    expect(selectNomenclatureQuestions([sulfate], { ...settings, categories: [] }, 0)).toEqual([]);
  });
});
