import { createHash } from "node:crypto";
import { normalizeAnswer, parseFormula } from "@inorganic/chemistry";
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
    if (record.status !== "reviewed" && record.status !== "owner-approved") continue;
    const parsed = parseFormula(record.formula, allowedSymbols);
    if (!parsed.ok || parsed.canonical !== record.formula) {
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
      const question =
        direction +
        ":" +
        (direction === "formula-to-name" ? record.formula : normalizeAnswer(record.nameCs));
      if (prompts.has(question)) problems.push({ code: "duplicate_question", recordId: record.id });
      prompts.add(question);
    }
    for (const name of [record.nameCs, ...record.aliases.names.map((alias) => alias.value)]) {
      const normalized = normalizeAnswer(name).normalize("NFD").replaceAll(/\p{M}/gu, "");
      const owner = nameOwners.get(normalized);
      if (owner && owner !== record.id) {
        problems.push({ code: "ambiguous_name", recordId: record.id });
      }
      nameOwners.set(normalized, record.id);
    }
    for (const formula of [
      record.formula,
      ...record.aliases.formulas.map((alias) => alias.value),
    ]) {
      const normalized = parseFormula(formula, allowedSymbols);
      if (!normalized.ok) continue;
      const owner = formulaOwners.get(normalized.canonical);
      if (owner && owner !== record.id) {
        problems.push({ code: "ambiguous_formula", recordId: record.id });
      }
      formulaOwners.set(normalized.canonical, record.id);
    }
  }
  return problems;
}

export function createNomenclatureSnapshot(records: readonly NomenclatureRecord[]): {
  readonly schemaVersion: 2;
  readonly contentVersion: string;
  readonly compounds: readonly NomenclatureRuntimeRecord[];
} {
  const compounds: NomenclatureRuntimeRecord[] = records
    .filter((record) => record.status === "reviewed" || record.status === "owner-approved")
    .map((record) => {
      if (!record.baseCategory || !record.difficulty) {
        throw new Error("Published nomenclature record has incomplete classification.");
      }
      const reviewLevel: NomenclatureRuntimeRecord["reviewLevel"] =
        record.status === "reviewed" ? "sme-reviewed" : "owner-approved";
      return {
        id: record.id,
        reviewLevel,
        formula: record.formula,
        nameCs: record.nameCs,
        explanationCs: record.explanationCs,
        baseCategory: record.baseCategory,
        tags: record.tags,
        difficulty: record.difficulty,
        contextCs: record.contextCs,
        directions: record.directions,
        nameAliases: record.aliases.names.map((alias) => alias.value),
        formulaAliases: record.aliases.formulas.map((alias) => alias.value),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const contentVersion =
    "nomenclature-v2-" +
    createHash("sha256")
      .update(JSON.stringify({ schemaVersion: 2, compounds }))
      .digest("hex")
      .slice(0, 12);
  return { schemaVersion: 2, contentVersion, compounds };
}
