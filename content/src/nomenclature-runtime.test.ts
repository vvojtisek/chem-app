import { describe, expect, it } from "vitest";
import { nomenclatureCollectionSchema, type NomenclatureRecord } from "./nomenclature-schema";
import {
  createNomenclatureSnapshot,
  deriveAnionFamily,
  validateNomenclatureRecords,
} from "./nomenclature-runtime";

const symbols = new Set(["Ag", "Al", "Cl", "F", "H", "N", "O", "S"]);
const draft: NomenclatureRecord = {
  id: "nomenclature.fixture-agcl",
  sourceKey: "AgCl",
  formula: "AgCl",
  charge: 0,
  nameCs: "chlorid stříbrný",
  explanationCs: "Fixture explanation.",
  baseCategory: "binary-salt",
  tags: [],
  difficulty: null,
  contextCs: null,
  directions: [],
  aliases: { names: [], formulas: [] },
  disposition: "core-candidate",
  reviewIssues: [],
  status: "draft",
  author: "fixture",
  sources: [{ title: "Unverified fixture seed", locator: "fixture:seed", kind: "seed" }],
};
const reviewed: NomenclatureRecord = {
  ...draft,
  difficulty: "basic",
  directions: ["formula-to-name", "name-to-formula"],
  status: "reviewed",
  sources: [{ title: "Fixture reference", locator: "fixture:reference", kind: "reference" }],
  reviewedBy: "Fixture reviewer",
  reviewedAt: "2026-09-22",
};
const ownerApproved: NomenclatureRecord = {
  ...reviewed,
  id: "nomenclature.fixture-hcl",
  sourceKey: "HCl",
  formula: "HCl",
  nameCs: "chlorovodík",
  status: "owner-approved",
  reviewedBy: undefined,
  reviewedAt: undefined,
  ownerApprovedBy: "Fixture content owner",
  ownerApprovedAt: "2026-09-23",
};

describe("nomenclature content gate", () => {
  it("never ships the draft seed", () => {
    expect(
      nomenclatureCollectionSchema.safeParse({ schemaVersion: 3, records: [draft] }).success,
    ).toBe(true);
    expect(createNomenclatureSnapshot([draft], symbols).compounds).toEqual([]);
  });

  it("requires scientific provenance and resolved review before eligibility", () => {
    expect(
      nomenclatureCollectionSchema.safeParse({
        schemaVersion: 3,
        records: [{ ...reviewed, reviewedBy: undefined, sources: draft.sources }],
      }).success,
    ).toBe(false);
    expect(
      nomenclatureCollectionSchema.safeParse({
        schemaVersion: 3,
        records: [{ ...reviewed, reviewIssues: ["R02"] }],
      }).success,
    ).toBe(false);
  });

  it("publishes owner-approved content without calling it SME-reviewed", () => {
    expect(
      nomenclatureCollectionSchema.safeParse({ schemaVersion: 3, records: [ownerApproved] })
        .success,
    ).toBe(true);
    expect(createNomenclatureSnapshot([ownerApproved], symbols).compounds).toMatchObject([
      { id: ownerApproved.id, reviewLevel: "owner-approved" },
    ]);
    expect(createNomenclatureSnapshot([reviewed], symbols).compounds[0]).toMatchObject({
      reviewLevel: "sme-reviewed",
    });
    expect(
      nomenclatureCollectionSchema.safeParse({
        schemaVersion: 3,
        records: [{ ...ownerApproved, ownerApprovedBy: undefined }],
      }).success,
    ).toBe(false);
    expect(
      nomenclatureCollectionSchema.safeParse({
        schemaVersion: 3,
        records: [{ ...ownerApproved, reviewIssues: ["R07"] }],
      }).success,
    ).toBe(false);
  });

  it("validates formulas and detects reverse-prompt collisions", () => {
    expect(validateNomenclatureRecords([reviewed], symbols)).toEqual([]);
    expect(validateNomenclatureRecords([{ ...reviewed, formula: "AgCl!" }], symbols)).toEqual([
      { code: "invalid_formula", recordId: reviewed.id },
    ]);
    expect(
      validateNomenclatureRecords(
        [
          reviewed,
          { ...reviewed, id: "nomenclature.fixture-other", sourceKey: "HCl", formula: "HCl" },
        ],
        symbols,
      ),
    ).toContainEqual({ code: "ambiguous_name", recordId: "nomenclature.fixture-other" });
  });

  it("rejects a cross-record formula alias and an untraceable alias", () => {
    const other: NomenclatureRecord = {
      ...reviewed,
      id: "nomenclature.fixture-other",
      sourceKey: "HCl",
      formula: "HCl",
      nameCs: "chlorovodík",
      aliases: {
        names: [],
        formulas: [{ value: "AgCl", reason: "fixture collision", sourceLocator: "missing" }],
      },
    };
    expect(validateNomenclatureRecords([reviewed, other], symbols)).toContainEqual({
      code: "ambiguous_formula",
      recordId: other.id,
    });
    expect(validateNomenclatureRecords([reviewed, other], symbols)).toContainEqual({
      code: "unknown_alias_source",
      recordId: other.id,
    });
  });

  it("produces a deterministic, public-only snapshot", () => {
    const otherDraft = { ...draft, id: "nomenclature.fixture-other", sourceKey: "HCl" };
    const snapshot = createNomenclatureSnapshot([otherDraft, reviewed], symbols);
    expect(snapshot.compounds).toHaveLength(1);
    expect(snapshot.compounds[0]).toMatchObject({
      id: reviewed.id,
      formula: "AgCl",
      charge: 0,
      nameCs: "chlorid stříbrný",
      category: "binary-salt",
      elementCount: 2,
      anionFamily: "chlorid",
    });
    expect(JSON.stringify(snapshot)).not.toContain("reviewedBy");
    expect(JSON.stringify(snapshot)).not.toContain("fixture:reference");
    expect(createNomenclatureSnapshot([reviewed, otherDraft], symbols)).toEqual(snapshot);
  });

  it("publishes ions and coordination formulas only from formula to name", () => {
    const sulfate: NomenclatureRecord = {
      ...ownerApproved,
      id: "nomenclature.fixture-sulfate",
      sourceKey: "SO42-",
      formula: "SO4",
      charge: -2,
      nameCs: "anion síranový",
      baseCategory: "element-ion",
      directions: ["formula-to-name"],
    };
    const hexafluoroaluminate: NomenclatureRecord = {
      ...ownerApproved,
      id: "nomenclature.fixture-alf6",
      sourceKey: "[AlF6]3-",
      formula: "[AlF6]",
      charge: -3,
      nameCs: "anion hexafluorohlinitanový",
      baseCategory: "coordination",
      directions: ["formula-to-name"],
    };
    expect(validateNomenclatureRecords([sulfate, hexafluoroaluminate], symbols)).toEqual([]);
    expect(
      createNomenclatureSnapshot([sulfate, hexafluoroaluminate], symbols).compounds,
    ).toMatchObject([
      { id: hexafluoroaluminate.id, charge: -3, elementCount: 2, anionFamily: null },
      { id: sulfate.id, charge: -2, elementCount: 2, anionFamily: null },
    ]);
    expect(
      nomenclatureCollectionSchema.safeParse({
        schemaVersion: 3,
        records: [{ ...sulfate, directions: ["formula-to-name", "name-to-formula"] }],
      }).success,
    ).toBe(false);
    expect(
      validateNomenclatureRecords(
        [{ ...hexafluoroaluminate, charge: 0, directions: ["formula-to-name", "name-to-formula"] }],
        symbols,
      ),
    ).toEqual([{ code: "invalid_formula", recordId: hexafluoroaluminate.id }]);
  });

  it("allows one name for two notations when only the formula is asked", () => {
    const secondNotation = {
      ...reviewed,
      id: "nomenclature.fixture-second",
      sourceKey: "Ag1Cl1",
      formula: "AgClAgCl",
      directions: ["formula-to-name" as const],
    };
    expect(validateNomenclatureRecords([reviewed, secondNotation], symbols)).toEqual([]);
    expect(
      validateNomenclatureRecords(
        [reviewed, { ...secondNotation, directions: ["formula-to-name", "name-to-formula"] }],
        symbols,
      ),
    ).toContainEqual({ code: "ambiguous_name", recordId: secondNotation.id });
  });

  it("detects names that collide once diacritics and spaces are ignored", () => {
    const lookalike = {
      ...reviewed,
      id: "nomenclature.fixture-lookalike",
      sourceKey: "HCl",
      formula: "HCl",
      nameCs: "chloridstribrny",
    };
    expect(validateNomenclatureRecords([reviewed, lookalike], symbols)).toContainEqual({
      code: "ambiguous_name",
      recordId: lookalike.id,
    });
  });
});

describe("deriveAnionFamily", () => {
  it.each([
    ["chlorid sodný", "chlorid"],
    ["síran hlinitý", "síran"],
    ["hydrogensíran draselný", "síran"],
    ["dihydrogenfosforečnan vápenatý", "fosforečnan"],
    ["pentahydrát síranu měďnatého", "síran"],
    ["dihydrát chloridu barnatého", "chlorid"],
    ["hydrát síranu vápenatého", "síran"],
    ["chlorid - chlornan vápenatý", "chlorid"],
    ["disulfid železnatý", "disulfid"],
  ])("reads %j as the %s family", (name, family) => {
    expect(deriveAnionFamily(name)).toBe(family);
  });
});
