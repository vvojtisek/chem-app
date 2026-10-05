import type { NomenclatureRuntimeRecord } from "@inorganic/content/nomenclature-schema";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_NOMENCLATURE_FILTERS,
  elementCountBucket,
  filterCompounds,
  isLegacyNomenclatureCheckpoint,
  listQuickFamilies,
  nomenclatureCheckpointSchema,
} from "./nomenclature-session";

function record(
  id: string,
  overrides: Partial<NomenclatureRuntimeRecord> = {},
): NomenclatureRuntimeRecord {
  return {
    id,
    reviewLevel: "owner-approved",
    formula: "NaCl",
    charge: 0,
    nameCs: id,
    explanationCs: "Fixture.",
    category: "binary-salt",
    elementCount: 2,
    anionFamily: "chlorid",
    tags: [],
    contextCs: null,
    directions: ["formula-to-name", "name-to-formula"],
    nameAliases: [],
    formulaAliases: [],
    ...overrides,
  };
}

const compounds = [
  record("nacl"),
  record("kcl"),
  record("cacl2"),
  record("nabr", { anionFamily: "bromid" }),
  record("na2so4", { category: "oxoacid-salt", anionFamily: "síran", elementCount: 3 }),
  record("cuso4-5h2o", { category: "oxoacid-salt", anionFamily: "síran", elementCount: 4 }),
  record("so4", {
    category: "element-ion",
    anionFamily: null,
    charge: -2,
    directions: ["formula-to-name"],
  }),
  record("ag", { category: "element-ion", anionFamily: null, elementCount: 1 }),
  record("alf6", { category: "coordination", anionFamily: null, directions: ["formula-to-name"] }),
];
const ids = (records: readonly NomenclatureRuntimeRecord[]) => records.map(({ id }) => id);

describe("nomenclature filters", () => {
  it("offers everything by default", () => {
    expect(filterCompounds(compounds, DEFAULT_NOMENCLATURE_FILTERS)).toHaveLength(compounds.length);
  });

  it("combines categories and the element count with AND", () => {
    expect(
      ids(
        filterCompounds(compounds, {
          categories: ["oxoacid-salt"],
          families: [],
          elementCount: "3",
        }),
      ),
    ).toEqual(["na2so4"]);
    expect(
      ids(
        filterCompounds(compounds, {
          categories: ["element-ion", "coordination"],
          families: [],
          elementCount: "2",
        }),
      ),
    ).toEqual(["so4", "alf6"]);
    expect(
      filterCompounds(compounds, { categories: ["hydroxide"], families: [], elementCount: "all" }),
    ).toEqual([]);
    expect(
      filterCompounds(compounds, { categories: [], families: [], elementCount: "all" }),
    ).toEqual([]);
  });

  it("narrows only the category of a selected quick family", () => {
    expect(
      ids(
        filterCompounds(compounds, {
          categories: ["binary-salt", "oxoacid-salt"],
          families: ["binary-salt:bromid"],
          elementCount: "all",
        }),
      ),
    ).toEqual(["nabr", "na2so4", "cuso4-5h2o"]);
  });

  it("buckets element counts as 1, 2, 3 and 4 or more", () => {
    expect([1, 2, 3, 4, 7].map(elementCountBucket)).toEqual(["1", "2", "3", "4+", "4+"]);
  });

  it("lists quick families with at least three records, largest first", () => {
    expect(listQuickFamilies(compounds, "binary-salt")).toEqual([
      { key: "binary-salt:chlorid", family: "chlorid", count: 3 },
    ]);
    expect(listQuickFamilies(compounds, "oxoacid-salt")).toEqual([]);
  });

  it("excludes incompatible questions instead of silently reversing the selected direction", () => {
    const eligible = filterCompounds(compounds, DEFAULT_NOMENCLATURE_FILTERS, "name-to-formula");
    expect(ids(eligible)).not.toContain("so4");
    expect(ids(eligible)).not.toContain("alf6");
    expect(ids(eligible)).toContain("ag");
    expect(eligible.every((item) => item.directions.includes("name-to-formula"))).toBe(true);
  });

  it("asks a record offered only by name from name to formula", () => {
    const acid = record("h3po3", { directions: ["name-to-formula"] });
    expect(filterCompounds([acid], DEFAULT_NOMENCLATURE_FILTERS, "formula-to-name")).toEqual([]);
    expect(filterCompounds([acid], DEFAULT_NOMENCLATURE_FILTERS, "name-to-formula")).toEqual([
      acid,
    ]);
  });
});

describe("nomenclature checkpoint", () => {
  const valid = {
    id: "active",
    checkpointVersion: 2,
    revision: 3,
    sessionId: "session",
    contentVersion: "v",
    filters: DEFAULT_NOMENCLATURE_FILTERS,
    currentId: "nacl",
    queueIds: ["kcl"],
    solvedIds: ["ag"],
    missedIds: ["kcl"],
    correct: 1,
    incorrect: 1,
    total: 3,
    sequence: 2,
    elapsedMs: 1_000,
  };

  it("accepts a consistent queue and rejects a repeated or solved question", () => {
    expect(nomenclatureCheckpointSchema.safeParse(valid).success).toBe(true);
    expect(
      nomenclatureCheckpointSchema.parse({ ...valid, direction: "name-to-formula" }).direction,
    ).toBe("name-to-formula");
    expect(nomenclatureCheckpointSchema.safeParse({ ...valid, direction: "invalid" }).success).toBe(
      false,
    );
    expect(nomenclatureCheckpointSchema.safeParse({ ...valid, queueIds: ["nacl"] }).success).toBe(
      false,
    );
    expect(nomenclatureCheckpointSchema.safeParse({ ...valid, solvedIds: ["kcl"] }).success).toBe(
      false,
    );
    expect(nomenclatureCheckpointSchema.safeParse({ ...valid, checkpointVersion: 1 }).success).toBe(
      false,
    );
  });

  it("recognizes a checkpoint from the series-based version", () => {
    expect(isLegacyNomenclatureCheckpoint({ id: "active", settings: {}, state: {} })).toBe(true);
    expect(isLegacyNomenclatureCheckpoint(valid)).toBe(false);
    expect(isLegacyNomenclatureCheckpoint(null)).toBe(false);
  });
});
