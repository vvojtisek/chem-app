import { describe, expect, it } from "vitest";

import {
  applyReviewStamp,
  createReviewFingerprint,
  findReviewFingerprintProblems,
  summarizeSmeReviewCoverage,
} from "./review";
import type { ElementRecord, GroupRecord, ReviewerRecord } from "./schema";

const sme: ReviewerRecord = {
  id: "reviewer.fixture-sme",
  name: "Fixture SME",
  role: "chemistry-sme",
  qualification: "Fixture qualification",
};
const editor: ReviewerRecord = {
  id: "reviewer.fixture-editor",
  name: "Fixture editor",
  role: "curriculum-editor",
};

const lanthanum: ElementRecord = {
  id: "element.057-la",
  atomicNumber: 57,
  symbol: "La",
  nameCs: "Lanthan",
  nameLat: "Lanthanum",
  period: 6,
  group: null,
  atomicWeight: 138.91,
  valenceConfiguration: "5d1 6s2",
  status: "reviewed",
  author: "fixture",
  sources: [{ title: "Fixture source", locator: "fixture:lanthanum" }],
  reviewedBy: sme.id,
  reviewedAt: "2026-09-22",
};
const smeReviewedLanthanum: ElementRecord = {
  ...lanthanum,
  reviewFingerprint: createReviewFingerprint(lanthanum),
};

const groupOne: GroupRecord = {
  id: "periodic-group.1",
  groupNumber: 1,
  nameCs: "Alkalické kovy",
  mnemonicCs: "Fixture mnemonic",
  elementSymbols: ["H", "Li"],
  status: "reviewed",
  author: "fixture",
  sources: [{ title: "Fixture source", locator: "fixture:group-1" }],
  reviewedBy: editor.id,
  reviewedAt: "2026-09-22",
};

describe("createReviewFingerprint", () => {
  it("is a stable SHA-256 digest independent of key order", () => {
    const reordered = Object.fromEntries(Object.entries(lanthanum).reverse()) as ElementRecord;

    expect(createReviewFingerprint(lanthanum)).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(createReviewFingerprint(reordered)).toBe(createReviewFingerprint(lanthanum));
  });

  it("changes when a scientific field or source changes", () => {
    const original = createReviewFingerprint(lanthanum);

    expect(createReviewFingerprint({ ...lanthanum, group: 3 })).not.toBe(original);
    expect(createReviewFingerprint({ ...lanthanum, nameLat: "Lanthanium" })).not.toBe(original);
    expect(
      createReviewFingerprint({
        ...lanthanum,
        sources: [{ title: "Other source", locator: "fixture:other" }],
      }),
    ).not.toBe(original);
    expect(createReviewFingerprint({ ...groupOne, elementSymbols: ["Li", "H"] })).not.toBe(
      createReviewFingerprint(groupOne),
    );
  });

  it("ignores review metadata", () => {
    expect(
      createReviewFingerprint({
        ...lanthanum,
        status: "in-review",
        author: "someone else",
        reviewedBy: editor.id,
        reviewedAt: "2027-01-01",
      }),
    ).toBe(createReviewFingerprint(lanthanum));
  });
});

describe("findReviewFingerprintProblems", () => {
  it("accepts a current SME review and an editor approval without a fingerprint", () => {
    expect(findReviewFingerprintProblems([smeReviewedLanthanum, groupOne], [sme, editor])).toEqual(
      [],
    );
  });

  it("reopens review when a scientific field changed after the review", () => {
    expect(findReviewFingerprintProblems([{ ...smeReviewedLanthanum, group: 3 }], [sme])).toEqual([
      { code: "stale_review_fingerprint", recordId: "element.057-la" },
    ]);
  });

  it("requires a fingerprint for an SME review", () => {
    expect(findReviewFingerprintProblems([lanthanum], [sme])).toEqual([
      { code: "missing_review_fingerprint", recordId: "element.057-la" },
    ]);
  });
});

describe("summarizeSmeReviewCoverage", () => {
  it("counts only shipped records with a current chemistry-SME review", () => {
    const editorApproved: ElementRecord = {
      ...lanthanum,
      id: "element.editor",
      reviewedBy: editor.id,
    };
    const staleSmeReview: ElementRecord = { ...smeReviewedLanthanum, id: "element.stale" };
    const draft: ElementRecord = { ...smeReviewedLanthanum, id: "element.draft", status: "draft" };

    expect(
      summarizeSmeReviewCoverage(
        [smeReviewedLanthanum, editorApproved, staleSmeReview, draft],
        [sme, editor],
      ),
    ).toEqual({
      smeReviewed: ["element.057-la"],
      pending: ["element.editor", "element.stale"],
    });
  });
});

describe("applyReviewStamp", () => {
  it("marks only the targeted records reviewed and keeps other fields and order", () => {
    const entries = [
      { id: "element.057-la", symbol: "La", status: "in-review" },
      { id: "element.058-ce", symbol: "Ce", status: "reviewed", reviewedBy: editor.id },
    ];

    const result = applyReviewStamp(entries, {
      reviewerId: sme.id,
      reviewedAt: "2026-09-22",
      fingerprints: new Map([["element.057-la", "sha256:fixture"]]),
    });

    expect(result.updatedIds).toEqual(["element.057-la"]);
    expect(result.entries).toEqual([
      {
        id: "element.057-la",
        symbol: "La",
        status: "reviewed",
        reviewedBy: sme.id,
        reviewedAt: "2026-09-22",
        reviewFingerprint: "sha256:fixture",
      },
      entries[1],
    ]);
    expect(Object.keys(result.entries[0] ?? {})).toEqual([
      "id",
      "symbol",
      "status",
      "reviewedBy",
      "reviewedAt",
      "reviewFingerprint",
    ]);
  });
});
