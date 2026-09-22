import { describe, expect, it } from "vitest";

import { elementRecordSchema, type ElementRecord, reviewerRecordSchema } from "./schema";
import { findElementCollectionProblems, findReviewerReferenceProblems } from "./validation";

const hydrogen: ElementRecord = {
  id: "element.hydrogen",
  atomicNumber: 1,
  symbol: "H",
  nameCs: "vodík",
  nameLat: "hydrogenium",
  period: 1,
  group: 1,
  atomicWeight: 1.008,
  valenceConfiguration: "1s1",
  status: "draft",
  author: "fixture",
  sources: [{ title: "Fixture source", locator: "fixture:hydrogen" }],
};

describe("findElementCollectionProblems", () => {
  it("accepts records with unique stable identity fields", () => {
    expect(findElementCollectionProblems([hydrogen])).toEqual([]);
  });

  it("reports duplicate identity fields", () => {
    expect(findElementCollectionProblems([hydrogen, hydrogen])).toEqual([
      { code: "duplicate_id", recordId: "element.hydrogen" },
      { code: "duplicate_atomic_number", recordId: "element.hydrogen" },
      { code: "duplicate_symbol", recordId: "element.hydrogen" },
    ]);
  });

  it("reports two different elements assigned to the same periodic-table position", () => {
    const lanthanum: ElementRecord = {
      ...hydrogen,
      id: "element.lanthanum",
      atomicNumber: 57,
      symbol: "La",
      period: 6,
      group: 3,
    };
    const lutetium: ElementRecord = {
      ...hydrogen,
      id: "element.lutetium",
      atomicNumber: 71,
      symbol: "Lu",
      period: 6,
      group: 3,
    };

    expect(findElementCollectionProblems([lanthanum, lutetium])).toEqual([
      { code: "duplicate_position", recordId: "element.lutetium" },
    ]);
  });
});

describe("reviewer provenance", () => {
  const editor = {
    id: "reviewer.project-curriculum",
    name: "Project curriculum approval",
    role: "curriculum-editor",
  } as const;
  const reviewedHydrogen: ElementRecord = {
    ...hydrogen,
    status: "reviewed",
    reviewedBy: editor.id,
    reviewedAt: "2026-09-22",
  };

  it("accepts a reviewed record that references a registered reviewer", () => {
    expect(findReviewerReferenceProblems([reviewedHydrogen], [editor])).toEqual([]);
  });

  it("reports an unregistered reviewer and a duplicate reviewer ID", () => {
    expect(
      findReviewerReferenceProblems(
        [{ ...reviewedHydrogen, reviewedBy: "reviewer.unknown" }],
        [editor, editor],
      ),
    ).toEqual([
      { code: "duplicate_reviewer_id", recordId: "reviewer.project-curriculum" },
      { code: "unknown_reviewer", recordId: "element.hydrogen" },
    ]);
  });

  it("rejects a free-text reviewer name instead of a reviewer ID", () => {
    expect(
      elementRecordSchema.safeParse({
        ...reviewedHydrogen,
        reviewedBy: "Project curriculum approval",
      }).success,
    ).toBe(false);
  });

  it("requires a qualification for a chemistry SME reviewer", () => {
    const sme = { id: "reviewer.sme", name: "Fixture SME", role: "chemistry-sme" };

    expect(reviewerRecordSchema.safeParse(sme).success).toBe(false);
    expect(
      reviewerRecordSchema.safeParse({ ...sme, qualification: "Fixture qualification" }).success,
    ).toBe(true);
  });
});
