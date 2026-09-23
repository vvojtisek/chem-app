import { readFile, writeFile } from "node:fs/promises";
import rawElements from "../data/elements.json";
import { nomenclatureCollectionSchema } from "./nomenclature-schema";
import { createNomenclatureSnapshot, validateNomenclatureRecords } from "./nomenclature-runtime";
import { elementCollectionSchema } from "./schema";

const inputUrl = new URL("../data/nomenclature.json", import.meta.url);
const outputUrl = new URL("../generated/nomenclature-runtime.json", import.meta.url);
const raw: unknown = JSON.parse(await readFile(inputUrl, "utf8"));
const records = nomenclatureCollectionSchema.parse(raw).records;
const symbols = new Set(
  elementCollectionSchema.parse(rawElements).map((element) => element.symbol),
);
const problems = validateNomenclatureRecords(records, symbols);
if (problems.length) throw new Error(JSON.stringify(problems, null, 2));
const snapshot = createNomenclatureSnapshot(records, symbols);
await writeFile(outputUrl, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Generated ${snapshot.compounds.length} published nomenclature records.`);
