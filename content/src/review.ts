import { createHash } from "node:crypto";

import { reviewFingerprintPayload } from "./review-fingerprint";
import type { ReviewerRecord } from "./schema";
import type { ValidationProblem } from "./validation";

export interface ReviewableRecord {
  readonly id: string;
  readonly status: string;
  readonly reviewedBy?: string | undefined;
  readonly reviewedAt?: string | undefined;
  readonly reviewFingerprint?: string | undefined;
  readonly fingerprintInput?: object | undefined;
}

export interface SmeReviewCoverage {
  readonly smeReviewed: readonly string[];
  readonly pending: readonly string[];
}

export interface ReviewStamp {
  readonly reviewerId: string;
  readonly reviewedAt: string;
  readonly fingerprints: ReadonlyMap<string, string>;
}

export function createReviewFingerprint(record: object): string {
  const digest = createHash("sha256").update(reviewFingerprintPayload(record)).digest("hex");

  return `sha256:${digest}`;
}

export function findReviewFingerprintProblems<T extends ReviewableRecord>(
  records: readonly T[],
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
    } else if (
      record.reviewFingerprint !== createReviewFingerprint(record.fingerprintInput ?? record)
    ) {
      problems.push({ code: "stale_review_fingerprint", recordId: record.id });
    }
  }

  return problems;
}

export function summarizeSmeReviewCoverage<T extends ReviewableRecord>(
  records: readonly T[],
  reviewers: readonly ReviewerRecord[],
): SmeReviewCoverage {
  const reviewersById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));
  const shipped = records.filter(
    (record) => record.status === "reviewed" || record.status === "owner-approved",
  );
  const hasCurrentSmeReview = (record: ReviewableRecord) =>
    isSmeReviewer(record, reviewersById) &&
    record.reviewFingerprint === createReviewFingerprint(record.fingerprintInput ?? record);

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
