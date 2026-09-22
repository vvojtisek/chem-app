import { createHash } from "node:crypto";

import type { ElementRecord, GroupRecord, ReviewerRecord } from "./schema";
import type { ValidationProblem } from "./validation";

export type ReviewableRecord = ElementRecord | GroupRecord;

export interface SmeReviewCoverage {
  readonly smeReviewed: readonly string[];
  readonly pending: readonly string[];
}

export interface ReviewStamp {
  readonly reviewerId: string;
  readonly reviewedAt: string;
  readonly fingerprints: ReadonlyMap<string, string>;
}

const reviewMetadataKeys: ReadonlySet<string> = new Set([
  "status",
  "author",
  "reviewedBy",
  "reviewedAt",
  "reviewFingerprint",
]);

export function createReviewFingerprint(record: ReviewableRecord): string {
  const reviewedFields = Object.entries(record).filter(([key]) => !reviewMetadataKeys.has(key));
  const digest = createHash("sha256")
    .update(toCanonicalJson(Object.fromEntries(reviewedFields)))
    .digest("hex");

  return `sha256:${digest}`;
}

export function findReviewFingerprintProblems(
  records: readonly ReviewableRecord[],
  reviewers: readonly ReviewerRecord[],
): readonly ValidationProblem[] {
  const reviewersById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));
  const problems: ValidationProblem[] = [];

  for (const record of records) {
    if (record.status !== "reviewed") continue;

    if (record.reviewFingerprint === undefined) {
      if (isSmeReviewer(record, reviewersById)) {
        problems.push({ code: "missing_review_fingerprint", recordId: record.id });
      }
    } else if (record.reviewFingerprint !== createReviewFingerprint(record)) {
      problems.push({ code: "stale_review_fingerprint", recordId: record.id });
    }
  }

  return problems;
}

export function summarizeSmeReviewCoverage(
  records: readonly ReviewableRecord[],
  reviewers: readonly ReviewerRecord[],
): SmeReviewCoverage {
  const reviewersById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));
  const shipped = records.filter((record) => record.status === "reviewed");
  const hasCurrentSmeReview = (record: ReviewableRecord) =>
    isSmeReviewer(record, reviewersById) &&
    record.reviewFingerprint === createReviewFingerprint(record);

  return {
    smeReviewed: shipped.filter(hasCurrentSmeReview).map(({ id }) => id),
    pending: shipped.filter((record) => !hasCurrentSmeReview(record)).map(({ id }) => id),
  };
}

export function applyReviewStamp(
  entries: readonly Readonly<Record<string, unknown>>[],
  stamp: ReviewStamp,
): {
  readonly entries: readonly Record<string, unknown>[];
  readonly updatedIds: readonly string[];
} {
  const updatedIds: string[] = [];
  const stamped = entries.map((entry) => {
    const fingerprint = typeof entry.id === "string" ? stamp.fingerprints.get(entry.id) : undefined;
    if (fingerprint === undefined || typeof entry.id !== "string") return { ...entry };

    updatedIds.push(entry.id);
    return {
      ...entry,
      status: "reviewed",
      reviewedBy: stamp.reviewerId,
      reviewedAt: stamp.reviewedAt,
      reviewFingerprint: fingerprint,
    };
  });

  return { entries: stamped, updatedIds };
}

function isSmeReviewer(
  record: ReviewableRecord,
  reviewersById: ReadonlyMap<string, ReviewerRecord>,
): boolean {
  return (
    record.reviewedBy !== undefined &&
    reviewersById.get(record.reviewedBy)?.role === "chemistry-sme"
  );
}

function toCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(toCanonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => compareCodeUnits(left, right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${toCanonicalJson(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
