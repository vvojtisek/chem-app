import { parseFormula } from "@inorganic/chemistry";
import {
  type NomenclatureRecord,
  nomenclatureRecordSchema,
} from "@inorganic/content/nomenclature-schema";
import {
  type NomenclatureProblem,
  validateNomenclatureRecords,
} from "@inorganic/content/nomenclature-snapshot";
import { curatedElements } from "@inorganic/content/runtime";

const ADMIN_KEY_PREFIX = "admin-";
const ID_PREFIX = "nomenclature.";
/** Placeholders that satisfy the schema; the server sets the real author and approval. */
const CONSOLE_AUTHOR = "Admin console";
const CONSOLE_APPROVAL = "Content owner via the admin console";

const elementSymbols: ReadonlySet<string> = new Set(
  curatedElements.map((element) => element.symbol),
);

type Category = NonNullable<NomenclatureRecord["baseCategory"]>;
type Difficulty = NonNullable<NomenclatureRecord["difficulty"]>;
type Direction = NomenclatureRecord["directions"][number];
type Tag = NomenclatureRecord["tags"][number];

export interface NomenclatureDraft {
  readonly formula: string;
  readonly charge: string;
  readonly nameCs: string;
  readonly explanationCs: string;
  readonly baseCategory: Category | "";
  readonly tags: readonly Tag[];
  readonly difficulty: Difficulty | "";
  readonly contextCs: string;
  readonly directions: readonly Direction[];
  readonly sourceTitle: string;
  readonly sourceLocator: string;
}

export type NomenclatureEditResult =
  | { readonly ok: true; readonly record: NomenclatureRecord }
  | { readonly ok: false; readonly errors: readonly string[] };

const PROBLEM_MESSAGES: Record<NomenclatureProblem["code"], string> = {
  duplicate_id: "Záznam s tímto ID už existuje.",
  duplicate_source_key: "Záznam s tímto klíčem zdroje už existuje.",
  invalid_formula:
    "Vzorec obsahuje neznámý prvek nebo chybný zápis. Otázka název → vzorec navíc potřebuje vzorec bez náboje v přesném tvaru, který student napíše.",
  invalid_formula_alias: "Alternativní vzorec nelze rozpoznat.",
  duplicate_question: "Stejnou otázku už klade jiný záznam (stejný vzorec, náboj nebo název).",
  ambiguous_name: "Stejný název už má jiný záznam, odpověď by nebyla jednoznačná.",
  ambiguous_formula: "Stejný vzorec se stejným nábojem už má jiný záznam.",
  unknown_alias_source: "Alternativní zápis odkazuje na zdroj, který záznam nemá.",
};

/** Only published records can be edited; drafts have open review issues. */
export function canEditNomenclature(record: NomenclatureRecord): boolean {
  return record.status === "owner-approved" || record.status === "reviewed";
}

export function nomenclatureDraft(record?: NomenclatureRecord): NomenclatureDraft {
  return {
    formula: record?.formula ?? "",
    charge: String(record?.charge ?? 0),
    nameCs: record?.nameCs ?? "",
    explanationCs: record?.explanationCs ?? "",
    baseCategory: record?.baseCategory ?? "",
    tags: record?.tags ?? [],
    difficulty: record?.difficulty ?? "",
    contextCs: record?.contextCs ?? "",
    directions: record?.directions ?? ["formula-to-name", "name-to-formula"],
    sourceTitle: "",
    sourceLocator: "",
  };
}

/**
 * The next free console key. Removed records stay in the file, so a number is never
 * reused for a different compound.
 */
export function nextAdminRecordKey(records: readonly NomenclatureRecord[]): string {
  let highest = 0;
  for (const record of records) {
    for (const key of [record.sourceKey, record.id.slice(ID_PREFIX.length)]) {
      const match = new RegExp(`^${ADMIN_KEY_PREFIX}([0-9]+)$`, "u").exec(key);
      if (match?.[1]) highest = Math.max(highest, Number(match[1]));
    }
  }
  return `${ADMIN_KEY_PREFIX}${highest + 1}`;
}

function problemKeys(problems: readonly NomenclatureProblem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { code, recordId } of problems) {
    const key = `${code} ${recordId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Problems the edit introduces; problems already in the data are not the editor's to fix. */
function newProblems(
  before: readonly NomenclatureRecord[],
  after: readonly NomenclatureRecord[],
): readonly NomenclatureProblem["code"][] {
  const existing = problemKeys(validateNomenclatureRecords(before, elementSymbols));
  const codes = new Set<NomenclatureProblem["code"]>();
  for (const [key, count] of problemKeys(validateNomenclatureRecords(after, elementSymbols))) {
    if (count > (existing.get(key) ?? 0)) {
      codes.add(key.split(" ")[0] as NomenclatureProblem["code"]);
    }
  }
  return [...codes];
}

function sameContent(left: NomenclatureRecord, right: NomenclatureRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Apply the owner's draft to a published record, or create a published record pending
 * validation. A changed record loses its validation; an unchanged one keeps it.
 */
export function editNomenclatureRecord(
  records: readonly NomenclatureRecord[],
  record: NomenclatureRecord | null,
  draft: NomenclatureDraft,
  today: string,
): NomenclatureEditResult {
  const errors: string[] = [];
  const typed = draft.formula.trim();
  const nameCs = draft.nameCs.trim().replace(/\s+/gu, " ");
  const explanationCs = draft.explanationCs.trim();
  const contextCs = draft.contextCs.trim();
  const charge = Number(draft.charge);
  // A formula the student types must be stored in canonical notation (CuSO4·5H2O).
  const parsed = parseFormula(typed, elementSymbols);
  const formula =
    draft.directions.includes("name-to-formula") && parsed.ok ? parsed.canonical : typed;
  if (!Number.isInteger(charge) || charge < -4 || charge > 4) {
    errors.push("Náboj musí být celé číslo od −4 do 4.");
  }
  if (!draft.baseCategory) errors.push("Vyberte kategorii.");
  if (draft.directions.length === 0) errors.push("Vyberte alespoň jeden směr procvičování.");
  if (charge !== 0 && draft.directions.includes("name-to-formula")) {
    errors.push("Ionty se procvičují jen ze vzorce na název.");
  }
  if (record === null) {
    if (draft.sourceTitle.trim().length === 0) errors.push("Doplňte název zdroje.");
    if (!/^https:\/\/\S+$/u.test(draft.sourceLocator.trim())) {
      errors.push("Odkaz na zdroj musí začínat https://.");
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const key = record ? null : nextAdminRecordKey(records);
  const content = {
    formula,
    charge,
    nameCs,
    explanationCs,
    baseCategory: draft.baseCategory || null,
    tags: [...draft.tags],
    difficulty: draft.difficulty || null,
    contextCs: contextCs || null,
    directions: [...draft.directions],
  };
  let candidate: unknown;
  if (record) {
    const edited = { ...record, ...content };
    if (sameContent(edited, record)) return { ok: true, record };
    const {
      reviewedBy: _reviewedBy,
      reviewedAt: _reviewedAt,
      reviewFingerprint: _reviewFingerprint,
      reviewEvidence: _reviewEvidence,
      reviewEvidenceConfirmedBy: _reviewEvidenceConfirmedBy,
      ...base
    } = edited;
    candidate = { ...base, status: "owner-approved" };
  } else {
    candidate = {
      id: `${ID_PREFIX}${key}`,
      sourceKey: key,
      ...content,
      aliases: { names: [], formulas: [] },
      disposition: "core-candidate",
      reviewIssues: [],
      status: "owner-approved",
      author: CONSOLE_AUTHOR,
      sources: [
        { title: draft.sourceTitle.trim(), locator: draft.sourceLocator.trim(), kind: "reference" },
      ],
      ownerApprovedBy: CONSOLE_APPROVAL,
      ownerApprovedAt: today,
    };
  }
  const result = nomenclatureRecordSchema.safeParse(candidate);
  if (!result.success) {
    return { ok: false, errors: ["Záznam není úplný: zkontrolujte vyplněná pole."] };
  }
  const changed = result.data;
  const next = record
    ? records.map((item) => (item.id === record.id ? changed : item))
    : [...records, changed];
  const problems = newProblems(records, next);
  if (problems.length > 0) {
    return { ok: false, errors: problems.map((code) => PROBLEM_MESSAGES[code]) };
  }
  return { ok: true, record: changed };
}
