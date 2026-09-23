import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { assertUniqueTopLevelKeys } from "./import-nomenclature-seed";
import {
  type NomenclatureRecord,
  nomenclatureCategorySchema,
  nomenclatureCollectionSchema,
  nomenclatureDirectionSchema,
  nomenclatureTagSchema,
} from "./nomenclature-schema";

export const SEED_TWO_LOCATOR = "docs/exec-plans/active/nomenclature-seed-2.json";
const SEED_TWO_HASH = "59319e3665f1366542581af1f0fc3d5aa97e6fe932766a656b4f5e82d0b4a6a1";
const APPROVED_AT = "2026-09-23";
const APPROVED_BY =
  "Content owner (VŠCHT-sourced seed; release authorized 2026-09-23; not an SME review)";

export const seedTwoSchema = z.record(
  z.string().min(1),
  z.strictObject({ nazev: z.string().min(1), napoveda: z.string().min(1) }),
);

const decisionSchema = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("existing-record") }),
  z.strictObject({ decision: z.literal("omit"), reason: z.string().min(1) }),
  z.strictObject({
    decision: z.literal("import"),
    formula: z.string().min(1),
    charge: z.number().int().min(-4).max(4),
    category: nomenclatureCategorySchema,
    directions: z.array(nomenclatureDirectionSchema).min(1),
    nameCs: z.string().min(1).optional(),
    formulaCorrection: z.literal(true).optional(),
    tags: z.array(nomenclatureTagSchema).optional(),
    nameAliases: z.array(z.string().min(1)).optional(),
    formulaAliases: z.array(z.string().min(1)).optional(),
    reviewIssue: z
      .string()
      .regex(/^R[0-9]{2}$/u)
      .optional(),
  }),
]);
export const seedTwoDecisionsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  decisions: z.record(z.string().min(1), decisionSchema),
});

const VSCHT_THEORY = {
  title: "VŠCHT Praha — Názvosloví (teoretická část)",
  locator: "https://e-learning.vscht.cz/mod/page/view.php?id=13158&lang=cs",
  kind: "reference",
} as const;
const VSCHT_COORDINATION = {
  title: "VŠCHT Praha — Názvosloví koordinačních sloučenin",
  locator: "https://e-learning.vscht.cz/mod/page/view.php?id=54358&lang=cs",
  kind: "reference",
} as const;
const SEED_SOURCE = {
  title: "Seed názvosloví od vlastníka obsahu (podle vlastníka z podkladů VŠCHT), 2026-09-23",
  locator: SEED_TWO_LOCATOR,
  kind: "seed",
} as const;

export function seedRecordId(sourceKey: string): string {
  return `nomenclature.seed-${createHash("sha256").update(sourceKey).digest("hex").slice(0, 12)}`;
}

/**
 * Turns the owner-approved second seed into authoring records following the reviewed
 * decisions file. Keys already present in the authoring data are left untouched, and a
 * decision naming a review issue keeps its record in review instead of releasing it.
 */
export function buildSeedTwoRecords(
  seed: z.infer<typeof seedTwoSchema>,
  decisions: z.infer<typeof seedTwoDecisionsSchema>,
  existingKeys: ReadonlySet<string>,
): NomenclatureRecord[] {
  const seedKeys = Object.keys(seed);
  const decisionKeys = Object.keys(decisions.decisions);
  const missing = seedKeys.filter((key) => !(key in decisions.decisions));
  const extra = decisionKeys.filter((key) => !(key in seed));
  if (missing.length || extra.length) {
    throw new Error(`Seed and decisions differ: missing ${missing}, extra ${extra}.`);
  }

  const records: NomenclatureRecord[] = [];
  for (const [sourceKey, entry] of Object.entries(seed)) {
    const decision = decisions.decisions[sourceKey];
    if (!decision) throw new Error(`Missing decision: ${sourceKey}`);
    if (decision.decision === "existing-record") {
      if (!existingKeys.has(sourceKey)) throw new Error(`Not an existing record: ${sourceKey}`);
      continue;
    }
    if (existingKeys.has(sourceKey)) throw new Error(`Already imported: ${sourceKey}`);
    if (decision.decision === "omit") continue;

    const held = decision.reviewIssue !== undefined;
    const aliasReason =
      "Varianta uvedená ve vysvětlení seedu; přijetí schválil vlastník obsahu 2026-09-23.";
    records.push({
      id: seedRecordId(sourceKey),
      sourceKey,
      formula: decision.formula,
      charge: decision.charge,
      nameCs: decision.nameCs ?? entry.nazev,
      explanationCs: entry.napoveda,
      baseCategory: decision.category,
      tags: decision.tags ?? [],
      difficulty: null,
      contextCs: null,
      directions: decision.directions,
      aliases: {
        names: (decision.nameAliases ?? []).map((value) => ({
          value,
          reason: aliasReason,
          sourceLocator: SEED_TWO_LOCATOR,
        })),
        formulas: (decision.formulaAliases ?? []).map((value) => ({
          value,
          reason: "Jiný zápis téže látky uvedený v seedu; schválil vlastník obsahu 2026-09-23.",
          sourceLocator: SEED_TWO_LOCATOR,
        })),
      },
      disposition: held ? "decision-required" : "core-candidate",
      reviewIssues: decision.reviewIssue === undefined ? [] : [decision.reviewIssue],
      status: held ? "in-review" : "owner-approved",
      author: "seed-import",
      sources: [
        SEED_SOURCE,
        decision.category === "coordination" ? VSCHT_COORDINATION : VSCHT_THEORY,
      ],
      ...(held ? {} : { ownerApprovedBy: APPROVED_BY, ownerApprovedAt: APPROVED_AT }),
    });
  }
  return records;
}

async function importSeedTwo(): Promise<void> {
  const seedUrl = new URL(`../../${SEED_TWO_LOCATOR}`, import.meta.url);
  const decisionsUrl = new URL(
    "../../docs/exec-plans/active/nomenclature-seed-2-decisions.json",
    import.meta.url,
  );
  const targetUrl = new URL("../data/nomenclature.json", import.meta.url);
  const input = await readFile(seedUrl, "utf8");
  if (createHash("sha256").update(input).digest("hex") !== SEED_TWO_HASH) {
    throw new Error("The archived second seed changed; review its diff before re-importing.");
  }
  assertUniqueTopLevelKeys(input);
  const seed = seedTwoSchema.parse(JSON.parse(input) as unknown);
  const decisions = seedTwoDecisionsSchema.parse(
    JSON.parse(await readFile(decisionsUrl, "utf8")) as unknown,
  );
  const existing = nomenclatureCollectionSchema.parse(
    JSON.parse(await readFile(targetUrl, "utf8")) as unknown,
  ).records;
  const fromThisSeed = new Set(
    existing
      .filter((record) => record.sources.some((source) => source.locator === SEED_TWO_LOCATOR))
      .map((record) => record.sourceKey),
  );
  const previousKeys = new Set(
    existing.map((record) => record.sourceKey).filter((key) => !fromThisSeed.has(key)),
  );
  const additions = buildSeedTwoRecords(seed, decisions, previousKeys).filter(
    (record) => !fromThisSeed.has(record.sourceKey),
  );
  if (!process.argv.includes("--write")) {
    console.log(`Seed entries: ${Object.keys(seed).length}; new records: ${additions.length}`);
    return;
  }
  const records = [...existing, ...additions].sort((a, b) =>
    a.sourceKey.localeCompare(b.sourceKey),
  );
  const collection = nomenclatureCollectionSchema.parse({ schemaVersion: 3, records });
  await writeFile(targetUrl, `${JSON.stringify(collection, null, 2)}\n`);
  console.log(`Nomenclature records: ${records.length}; added: ${additions.length}`);
}

if (process.argv[1]?.endsWith("import-nomenclature-seed-2.ts")) {
  await importSeedTwo();
}
