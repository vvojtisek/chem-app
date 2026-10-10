import type { components } from "@inorganic/contracts";
import {
  type NomenclatureRecord,
  nomenclatureRecordSchema,
} from "@inorganic/content/nomenclature-schema";
import {
  buildNomenclatureCompounds,
  NOMENCLATURE_VERSION_PREFIX,
  nomenclatureVersionPayload,
} from "@inorganic/content/nomenclature-snapshot";
import { curatedElements } from "@inorganic/content/runtime";

import { computeReviewFingerprint, type ReviewEvidence } from "./curriculum-review";

export type StoredNomenclatureRecord = components["schemas"]["StoredNomenclatureRecord"];
export type NomenclatureRecordInput = components["schemas"]["NomenclatureRecordInput"];
export type NomenclatureRuntimeSnapshot = components["schemas"]["NomenclatureRuntimeSnapshot"];

/** `unpublished` covers drafts and records held for review: learners do not see them. */
export type NomenclatureState = "validated" | "pending" | "unpublished" | "removed";

export type NomenclatureAction =
  | { readonly kind: "validate"; readonly evidence: ReviewEvidence }
  | { readonly kind: "unvalidate" }
  | { readonly kind: "remove" };

export interface NomenclatureSave {
  readonly record: NomenclatureRecordInput;
  readonly runtimeSnapshot: NomenclatureRuntimeSnapshot;
}

const NULLABLE_KEYS: ReadonlySet<string> = new Set(["baseCategory", "difficulty", "contextCs"]);
const elementSymbols: ReadonlySet<string> = new Set(
  curatedElements.map((element) => element.symbol),
);

export function nomenclatureState(record: { readonly status: string }): NomenclatureState {
  if (record.status === "reviewed") return "validated";
  if (record.status === "owner-approved") return "pending";
  if (record.status === "deprecated") return "removed";
  return "unpublished";
}

export function countNomenclatureStates(
  records: readonly NomenclatureRecord[],
): Record<NomenclatureState, number> {
  const counts = { validated: 0, pending: 0, unpublished: 0, removed: 0 };
  for (const record of records) counts[nomenclatureState(record)] += 1;
  return counts;
}

/**
 * Validation and withdrawal keep a record published; neither can publish a draft or a
 * record held for review, because those still have open review issues. Those can only
 * be removed here. A removed record stays removed.
 */
export function availableNomenclatureActions(
  record: NomenclatureRecord,
): readonly NomenclatureAction["kind"][] {
  if (record.status === "reviewed") return ["unvalidate", "remove"];
  if (record.status === "owner-approved") return ["validate", "remove"];
  if (record.status === "deprecated") return [];
  return ["remove"];
}

/** Restore the file shape of a record: the API lists absent optional fields as null. */
export function toFileRecord(stored: StoredNomenclatureRecord): NomenclatureRecord {
  return nomenclatureRecordSchema.parse(
    Object.fromEntries(
      Object.entries(stored).filter(([key, value]) => value !== null || NULLABLE_KEYS.has(key)),
    ),
  );
}

/**
 * Apply one review action and return the save request: the changed record and the
 * learner-app snapshot rebuilt from all records with the content package's own code.
 */
export async function applyNomenclatureAction(
  records: readonly NomenclatureRecord[],
  record: NomenclatureRecord,
  action: NomenclatureAction,
): Promise<NomenclatureSave> {
  if (!availableNomenclatureActions(record).includes(action.kind)) {
    throw new Error(`Action ${action.kind} is not allowed for this record.`);
  }
  const {
    reviewedBy: _reviewedBy,
    reviewedAt: _reviewedAt,
    reviewFingerprint: _reviewFingerprint,
    reviewEvidence: _reviewEvidence,
    reviewEvidenceConfirmedBy: _reviewEvidenceConfirmedBy,
    ...base
  } = record;
  let changed: NomenclatureRecord;
  if (action.kind === "validate") {
    const confirmedBy = action.evidence.confirmedBy.trim();
    changed = {
      ...base,
      status: "reviewed",
      reviewFingerprint: await computeReviewFingerprint(record),
      reviewEvidence: action.evidence.evidence.trim(),
      ...(confirmedBy.length > 0 ? { reviewEvidenceConfirmedBy: confirmedBy } : {}),
    };
  } else {
    changed = { ...base, status: action.kind === "remove" ? "deprecated" : "owner-approved" };
  }
  return nomenclatureSave(records, changed);
}

/** The save request for one changed or new record, with the snapshot rebuilt from all records. */
export async function nomenclatureSave(
  records: readonly NomenclatureRecord[],
  changed: NomenclatureRecord,
): Promise<NomenclatureSave> {
  const next = records.some((item) => item.id === changed.id)
    ? records.map((item) => (item.id === changed.id ? changed : item))
    : [...records, changed];
  return { record: toRecordInput(changed), runtimeSnapshot: await buildRuntimeSnapshot(next) };
}

export async function buildRuntimeSnapshot(
  records: readonly NomenclatureRecord[],
): Promise<NomenclatureRuntimeSnapshot> {
  const compounds = buildNomenclatureCompounds(records, elementSymbols);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(nomenclatureVersionPayload(compounds)),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"));
  return {
    schemaVersion: 3,
    contentVersion: `${NOMENCLATURE_VERSION_PREFIX}${hex.join("").slice(0, 12)}`,
    compounds,
  };
}

/** The fields the console sends; author, approval and reviewer stay with the server. */
export function toRecordInput(record: NomenclatureRecord): NomenclatureRecordInput {
  return {
    id: record.id,
    sourceKey: record.sourceKey,
    formula: record.formula,
    charge: record.charge,
    nameCs: record.nameCs,
    explanationCs: record.explanationCs,
    baseCategory: record.baseCategory,
    tags: record.tags,
    difficulty: record.difficulty,
    contextCs: record.contextCs,
    directions: record.directions,
    aliases: record.aliases,
    disposition: record.disposition,
    reviewIssues: record.reviewIssues,
    status: record.status,
    sources: record.sources,
    reviewFingerprint: record.reviewFingerprint ?? null,
    reviewEvidence: record.reviewEvidence ?? null,
    reviewEvidenceConfirmedBy: record.reviewEvidenceConfirmedBy ?? null,
  };
}
