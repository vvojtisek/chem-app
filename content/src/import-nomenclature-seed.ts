import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { nomenclatureCollectionSchema, type NomenclatureRecord } from "./nomenclature-schema";

const seedUrl = new URL("../../docs/exec-plans/active/nomenclature-seed.json", import.meta.url);
const ledgerUrl = new URL(
  "../../docs/exec-plans/active/nomenclature-seed-review.md",
  import.meta.url,
);
const targetUrl = new URL("../data/nomenclature.json", import.meta.url);

// The 2026-09-22 ledger predates the schema-v3 categories; drafts it adds get the closest one.
const legacyCategories = {
  oxide: "oxide",
  hydroxide: "hydroxide",
  "binary-acid": "binary-acid",
  "binary-salt": "binary-salt",
  oxoacid: "oxoacid",
  "oxoacid-salt": "oxoacid-salt",
  hydrogensalt: "oxoacid-salt",
  extension: "other",
} as const satisfies Record<string, NonNullable<NomenclatureRecord["baseCategory"]>>;
const legacyCategorySchema = z.enum([
  "oxide",
  "hydroxide",
  "binary-acid",
  "binary-salt",
  "oxoacid",
  "oxoacid-salt",
  "hydrogensalt",
  "extension",
]);

const seedEntrySchema = z.strictObject({
  nazev: z.string().min(1),
  napoveda: z.string().min(1),
});
const seedSchema = z.record(z.string().min(1), seedEntrySchema);

export function assertUniqueTopLevelKeys(input: string): void {
  let depth = 0;
  const keys = new Set<string>();
  for (let position = 0; position < input.length; position += 1) {
    const character = input[position];
    if (character === '"') {
      const start = position;
      position += 1;
      while (position < input.length) {
        if (input[position] === "\\") position += 2;
        else if (input[position] === '"') break;
        else position += 1;
      }
      if (position >= input.length) throw new Error("Unterminated seed string.");
      if (depth === 1) {
        const key: unknown = JSON.parse(input.slice(start, position + 1));
        if (typeof key !== "string") throw new Error("Invalid seed key.");
        if (keys.has(key)) throw new Error(`Duplicate seed key: ${key}`);
        keys.add(key);
      }
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
  }
}

async function importSeed(): Promise<void> {
  const input = await readFile(seedUrl, "utf8");
  if (Buffer.byteLength(input, "utf8") > 250_000) {
    throw new Error("Nomenclature seed exceeds the import size limit.");
  }
  const archiveHash = createHash("sha256").update(input).digest("hex");
  if (archiveHash !== "ae7e9783d8a36a9bc7f883e446d5e16f3acfa99b9ef1af2fa955ab748ff74f99") {
    throw new Error("The archived seed changed; review its diff before re-importing.");
  }
  assertUniqueTopLevelKeys(input);
  const seed = seedSchema.parse(JSON.parse(input) as unknown);
  const ledger = await readFile(ledgerUrl, "utf8");
  const entries = new Map<
    string,
    {
      category: NomenclatureRecord["baseCategory"];
      disposition: NomenclatureRecord["disposition"];
      issues: string[];
    }
  >();
  for (const line of ledger.split("\n")) {
    const match =
      /^\| \x60([^\x60]+)\x60 \| [^|]+ \| \x60([^\x60]+)\x60 \| (?:yes|no) \| \x60([^\x60]+)\x60 \| ([^|]+) \|$/u.exec(
        line,
      );
    if (!match) continue;
    const [, key, rawCategory, rawDisposition, rawIssues] = match;
    if (!key || !rawCategory || !rawDisposition || !rawIssues) {
      throw new Error("Invalid ledger row.");
    }
    const category = legacyCategories[legacyCategorySchema.parse(rawCategory)];
    const disposition = z
      .enum(["core-candidate", "decision-required", "defer-grammar", "defer-scope"])
      .parse(rawDisposition);
    if (entries.has(key)) throw new Error(`Duplicate ledger entry: ${key}`);
    entries.set(key, {
      category,
      disposition,
      issues: rawIssues.trim() === "—" ? [] : rawIssues.trim().split(", "),
    });
  }
  if (entries.size !== Object.keys(seed).length) throw new Error("Seed and ledger counts differ.");

  let existing: NomenclatureRecord[] = [];
  try {
    existing = nomenclatureCollectionSchema.parse(
      JSON.parse(await readFile(targetUrl, "utf8")) as unknown,
    ).records;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const byKey = new Map(existing.map((record) => [record.sourceKey, record]));
  const additions: NomenclatureRecord[] = [];
  for (const [sourceKey, value] of Object.entries(seed)) {
    const entry = entries.get(sourceKey);
    if (!entry) throw new Error(`Missing ledger entry: ${sourceKey}`);
    if (byKey.has(sourceKey)) continue;
    additions.push({
      id: `nomenclature.seed-${createHash("sha256").update(sourceKey).digest("hex").slice(0, 12)}`,
      sourceKey,
      formula: sourceKey.replaceAll(".", "·"),
      charge: 0,
      nameCs: value.nazev,
      explanationCs: value.napoveda,
      baseCategory: entry.category,
      tags: sourceKey.includes(".") ? ["hydrate"] : [],
      difficulty: null,
      contextCs: null,
      directions: [],
      aliases: { names: [], formulas: [] },
      disposition: entry.disposition,
      reviewIssues: entry.issues,
      status: "draft",
      author: "seed-import",
      sources: [
        {
          title: "User-provided nomenclature seed (unverified)",
          locator: "docs/exec-plans/active/nomenclature-seed.json",
          kind: "seed",
        },
      ],
    });
  }
  if (!process.argv.includes("--write")) {
    console.log(`Seed entries: ${Object.keys(seed).length}; new drafts: ${additions.length}`);
    return;
  }
  const records = [...existing, ...additions].sort((a, b) =>
    a.sourceKey.localeCompare(b.sourceKey),
  );
  const collection = nomenclatureCollectionSchema.parse({ schemaVersion: 3, records });
  await writeFile(targetUrl, `${JSON.stringify(collection, null, 2)}\n`);
  console.log(`Nomenclature drafts: ${records.length}; added: ${additions.length}`);
}

if (process.argv[1]?.endsWith("import-nomenclature-seed.ts")) {
  await importSeed();
}
