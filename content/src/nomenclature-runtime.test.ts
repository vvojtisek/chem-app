import { describe, expect, it } from "vitest";
import { nomenclatureCollectionSchema, type NomenclatureRecord } from "./nomenclature-schema";
import { createNomenclatureSnapshot, validateNomenclatureRecords } from "./nomenclature-runtime";

const symbols = new Set(["Ag", "Cl", "H", "O"]);
const draft: NomenclatureRecord = {
  id: "nomenclature.fixture-agcl",
  sourceKey: "AgCl",
  formula: "AgCl",
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
      nomenclatureCollectionSchema.safeParse({ schemaVersion: 2, records: [draft] }).success,
    ).toBe(true);
    expect(createNomenclatureSnapshot([draft]).compounds).toEqual([]);
  });

  it("requires scientific provenance and resolved review before eligibility", () => {
    expect(
      nomenclatureCollectionSchema.safeParse({
        schemaVersion: 2,
        records: [{ ...reviewed, reviewedBy: undefined, sources: draft.sources }],
      }).success,
    ).toBe(false);
    expect(
      nomenclatureCollectionSchema.safeParse({
        schemaVersion: 2,
        records: [{ ...reviewed, reviewIssues: ["R02"] }],
      }).success,
    ).toBe(false);
  });

  it("publishes owner-approved content without calling it SME-reviewed", () => {
    expect(
      nomenclatureCollectionSchema.safeParse({ schemaVersion: 2, records: [ownerApproved] })
        .success,
    ).toBe(true);
    expect(createNomenclatureSnapshot([ownerApproved]).compounds).toMatchObject([
      { id: ownerApproved.id, reviewLevel: "owner-approved" },
    ]);
    expect(createNomenclatureSnapshot([reviewed]).compounds[0]).toMatchObject({
      reviewLevel: "sme-reviewed",
    });
    expect(
      nomenclatureCollectionSchema.safeParse({
        schemaVersion: 2,
        records: [{ ...ownerApproved, ownerApprovedBy: undefined }],
      }).success,
    ).toBe(false);
    expect(
      nomenclatureCollectionSchema.safeParse({
        schemaVersion: 2,
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
    const snapshot = createNomenclatureSnapshot([otherDraft, reviewed]);
    expect(snapshot.compounds).toHaveLength(1);
    expect(snapshot.compounds[0]).toMatchObject({
      id: reviewed.id,
      formula: "AgCl",
      nameCs: "chlorid stříbrný",
    });
    expect(JSON.stringify(snapshot)).not.toContain("reviewedBy");
    expect(JSON.stringify(snapshot)).not.toContain("fixture:reference");
    expect(createNomenclatureSnapshot([reviewed, otherDraft])).toEqual(snapshot);
  });
});
