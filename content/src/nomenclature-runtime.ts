import { createHash } from "node:crypto";
import { compactLenientAnswer, listFormulaElements, parseFormula } from "@inorganic/chemistry";
import type { NomenclatureRecord, NomenclatureRuntimeRecord } from "./nomenclature-schema";

export interface NomenclatureProblem {
  readonly code:
    | "duplicate_id"
    | "duplicate_source_key"
    | "invalid_formula"
    | "invalid_formula_alias"
    | "duplicate_question"
    | "ambiguous_name"
    | "ambiguous_formula"
    | "unknown_alias_source";
  readonly recordId: string;
}

const SALT_CATEGORIES: ReadonlySet<NomenclatureRecord["baseCategory"]> = new Set([
  "binary-salt",
  "oxoacid-salt",
]);

function isPublished(record: NomenclatureRecord): boolean {
  return record.status === "reviewed" || record.status === "owner-approved";
}

function formulaPrompt(record: NomenclatureRecord): string {
  return record.charge === 0 ? record.formula : `${record.formula} ${record.charge}`;
}

export function validateNomenclatureRecords(
  records: readonly NomenclatureRecord[],
  allowedSymbols: ReadonlySet<string>,
): readonly NomenclatureProblem[] {
  const problems: NomenclatureProblem[] = [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  const prompts = new Set<string>();
  const nameOwners = new Map<string, string>();
  const formulaOwners = new Map<string, string>();
  for (const record of records) {
    if (ids.has(record.id)) problems.push({ code: "duplicate_id", recordId: record.id });
    if (keys.has(record.sourceKey))
      problems.push({ code: "duplicate_source_key", recordId: record.id });
    ids.add(record.id);
    keys.add(record.sourceKey);
    if (!isPublished(record)) continue;

    const asksForFormula = record.directions.includes("name-to-formula");
    const parsed = parseFormula(record.formula, allowedSymbols);
    const typeable = parsed.ok && parsed.canonical === record.formula && record.charge === 0;
    if (
      listFormulaElements(record.formula, allowedSymbols) === null ||
      (asksForFormula && !typeable)
    ) {
      problems.push({ code: "invalid_formula", recordId: record.id });
      continue;
    }
    const sourceLocators = new Set(record.sources.map((source) => source.locator));
    for (const alias of [...record.aliases.names, ...record.aliases.formulas]) {
      if (!sourceLocators.has(alias.sourceLocator)) {
        problems.push({ code: "unknown_alias_source", recordId: record.id });
      }
    }
    for (const alias of record.aliases.formulas) {
      if (!parseFormula(alias.value, allowedSymbols).ok) {
        problems.push({ code: "invalid_formula_alias", recordId: record.id });
      }
    }
    for (const direction of record.directions) {
      const question = `${direction}:${
        direction === "formula-to-name"
          ? formulaPrompt(record)
          : compactLenientAnswer(record.nameCs)
      }`;
      if (prompts.has(question)) problems.push({ code: "duplicate_question", recordId: record.id });
      prompts.add(question);
    }
    // A name asked for its formula must lead to exactly one record, also after the lenient
    // normalization that the practice applies to typed names.
    if (asksForFormula) {
      for (const name of [record.nameCs, ...record.aliases.names.map((alias) => alias.value)]) {
        const normalized = compactLenientAnswer(name);
        const owner = nameOwners.get(normalized);
        if (owner && owner !== record.id) {
          problems.push({ code: "ambiguous_name", recordId: record.id });
        }
        nameOwners.set(normalized, record.id);
      }
    }
    for (const formula of [
      record.formula,
      ...record.aliases.formulas.map((alias) => alias.value),
    ]) {
      const normalized = parseFormula(formula, allowedSymbols);
      const key = `${normalized.ok ? normalized.canonical : formula} ${record.charge}`;
      const owner = formulaOwners.get(key);
      if (owner && owner !== record.id) {
        problems.push({ code: "ambiguous_formula", recordId: record.id });
      }
      formulaOwners.set(key, record.id);
    }
  }
  return problems;
}

/**
 * The anion word that opens a salt name (or follows a hydrate prefix), without a hydrogen
 * prefix: "hexahydrát chloridu barnatého" -> "chlorid", "hydrogensíran sodný" -> "síran".
 */
export function deriveAnionFamily(nameCs: string): string {
  const [first = "", second = ""] = nameCs.trim().split(/\s+/u);
  const word = /hydrát$/u.test(first) && second ? second.replace(/u$/u, "") : first;
  return word.replace(/^(?:di)?hydrogen(?=\p{L})/u, "");
}

export function createNomenclatureSnapshot(
  records: readonly NomenclatureRecord[],
  allowedSymbols: ReadonlySet<string>,
): {
  readonly schemaVersion: 3;
  readonly contentVersion: string;
  readonly compounds: readonly NomenclatureRuntimeRecord[];
} {
  const compounds: NomenclatureRuntimeRecord[] = records
    .filter(isPublished)
    .map((record) => {
      const elements = listFormulaElements(record.formula, allowedSymbols);
      if (!record.baseCategory || !elements) {
        throw new Error("Published nomenclature record has incomplete classification.");
      }
      const reviewLevel: NomenclatureRuntimeRecord["reviewLevel"] =
        record.status === "reviewed" ? "sme-reviewed" : "owner-approved";
      return {
        id: record.id,
        reviewLevel,
        formula: record.formula,
        charge: record.charge,
        nameCs: record.nameCs,
        explanationCs: record.explanationCs,
        category: record.baseCategory,
        elementCount: elements.length,
        anionFamily: SALT_CATEGORIES.has(record.baseCategory)
          ? deriveAnionFamily(record.nameCs)
          : null,
        tags: record.tags,
        contextCs: record.contextCs,
        directions: record.directions,
        nameAliases: record.aliases.names.map((alias) => alias.value),
        formulaAliases: record.aliases.formulas.map((alias) => alias.value),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const contentVersion =
    "nomenclature-v3-" +
    createHash("sha256")
      .update(JSON.stringify({ schemaVersion: 3, compounds }))
      .digest("hex")
      .slice(0, 12);
  return { schemaVersion: 3, contentVersion, compounds };
}
