import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildSeedTwoRecords,
  SEED_TWO_LOCATOR,
  seedRecordId,
  seedTwoDecisionsSchema,
  seedTwoSchema,
} from "./import-nomenclature-seed-2";
import { nomenclatureCollectionSchema } from "./nomenclature-schema";

const seed = {
  PI3: { nazev: "jodid fosforečný", napoveda: "3 × I(-I), P(+III) -> jodid fosforitý." },
  NaCl: { nazev: "chlorid sodný", napoveda: "Na(+I), Cl(-I)." },
  "P(OR)3": { nazev: "?", napoveda: "R je zástupný symbol." },
  CuFeS2: { nazev: "bis(sulfid) měďnato-železnatý", napoveda: "Chalkopyrit." },
};

function decisions() {
  return seedTwoDecisionsSchema.parse({
    schemaVersion: 1,
    decisions: {
      PI3: {
        decision: "import",
        formula: "PI3",
        charge: 0,
        category: "binary-salt",
        directions: ["formula-to-name", "name-to-formula"],
        nameCs: "jodid fosforitý",
        nameAliases: ["trijodid fosforu"],
      },
      NaCl: { decision: "existing-record" },
      "P(OR)3": { decision: "omit", reason: "Not a compound." },
      CuFeS2: {
        decision: "import",
        formula: "CuFeS2",
        charge: 0,
        category: "binary-salt",
        directions: ["formula-to-name"],
        reviewIssue: "R17",
      },
    },
  });
}

describe("second seed import", () => {
  it("releases corrected records as owner-approved with the seed and VŠCHT sources", () => {
    const [iodide] = buildSeedTwoRecords(seed, decisions(), new Set(["NaCl"]));
    expect(iodide).toMatchObject({
      id: seedRecordId("PI3"),
      formula: "PI3",
      nameCs: "jodid fosforitý",
      explanationCs: seed.PI3.napoveda,
      status: "owner-approved",
      disposition: "core-candidate",
      reviewIssues: [],
      ownerApprovedAt: "2026-09-23",
    });
    expect(iodide?.ownerApprovedBy).toContain("not an SME review");
    expect(iodide?.sources.map(({ kind }) => kind)).toEqual(["seed", "reference"]);
    expect(iodide?.aliases.names).toEqual([
      expect.objectContaining({ value: "trijodid fosforu", sourceLocator: SEED_TWO_LOCATOR }),
    ]);
  });

  it("skips omitted and existing keys and keeps a record with a review issue unreleased", () => {
    const records = buildSeedTwoRecords(seed, decisions(), new Set(["NaCl"]));
    expect(records.map(({ sourceKey }) => sourceKey)).toEqual(["PI3", "CuFeS2"]);
    const held = records[1];
    expect(held).toMatchObject({
      status: "in-review",
      disposition: "decision-required",
      reviewIssues: ["R17"],
    });
    expect(held).not.toHaveProperty("ownerApprovedBy");
  });

  it("rejects decisions that do not match the seed or the existing records", () => {
    const { NaCl: _, ...withoutSalt } = decisions().decisions;
    expect(() =>
      buildSeedTwoRecords(seed, { schemaVersion: 1, decisions: withoutSalt }, new Set()),
    ).toThrow("Seed and decisions differ");
    expect(() => buildSeedTwoRecords(seed, decisions(), new Set())).toThrow(
      "Not an existing record: NaCl",
    );
    expect(() => buildSeedTwoRecords(seed, decisions(), new Set(["NaCl", "PI3"]))).toThrow(
      "Already imported: PI3",
    );
  });

  it("matches the authoring data exactly for the archived seed and decisions", () => {
    const read = (path: string): unknown =>
      JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
    const archivedSeed = seedTwoSchema.parse(read(`../../${SEED_TWO_LOCATOR}`));
    const archivedDecisions = seedTwoDecisionsSchema.parse(
      read("../../docs/exec-plans/active/nomenclature-seed-2-decisions.json"),
    );
    const { records } = nomenclatureCollectionSchema.parse(read("../data/nomenclature.json"));
    const fromSeed = (record: (typeof records)[number]) =>
      record.sources.some(({ locator }) => locator === SEED_TWO_LOCATOR);
    const earlierKeys = new Set(
      records.filter((record) => !fromSeed(record)).map(({ sourceKey }) => sourceKey),
    );
    const byKey = (left: { sourceKey: string }, right: { sourceKey: string }) =>
      left.sourceKey.localeCompare(right.sourceKey);

    const rebuilt = buildSeedTwoRecords(archivedSeed, archivedDecisions, earlierKeys).sort(byKey);
    expect(records.filter(fromSeed)).toEqual(rebuilt);
    expect(rebuilt).toHaveLength(384);
    expect(rebuilt.filter(({ status }) => status !== "owner-approved")).toEqual([
      expect.objectContaining({ sourceKey: "CuFeS2", reviewIssues: ["R17"] }),
    ]);
  });
});
