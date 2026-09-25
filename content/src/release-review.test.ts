import { describe, expect, it } from "vitest";
import { alternateGroupMnemonicRecordSchema } from "./alternate-group-mnemonic-schema";
import { loadAuthoringContent } from "./authoring-content";
import { nomenclatureRecordSchema } from "./nomenclature-schema";
import {
  preparationProductionProductSchema,
  preparationProductionRouteSchema,
} from "./preparation-production-schema";
import { collectReleaseReviewTargets, loadReleaseReviewSources } from "./release-review";
import {
  createReviewFingerprint,
  findReviewFingerprintProblems,
  summarizeSmeReviewCoverage,
} from "./review";

const [content, sources] = await Promise.all([loadAuthoringContent(), loadReleaseReviewSources()]);
const targets = collectReleaseReviewTargets(content, sources);
const sme = content.reviewers.find((reviewer) => reviewer.role === "chemistry-sme");
if (!sme) throw new Error("Missing fixture SME reviewer.");

describe("production chemistry review coverage", () => {
  it("includes every family actually published in the learner runtime", () => {
    const counts = new Map<string, number>();
    for (const target of targets) counts.set(target.family, (counts.get(target.family) ?? 0) + 1);
    expect(counts.get("element")).toBe(118);
    expect(counts.get("group")).toBe(8);
    expect(counts.get("alternate-mnemonic")).toBe(8);
    expect(counts.get("nomenclature")).toBe(469);
    expect(counts.get("route")).toBe(116);
    expect(counts.get("product")).toBe(sources.preparationProduction.products.length);
    expect(targets).not.toContainEqual(expect.objectContaining({ status: "in-review" }));
  });

  it.each(["alternate-mnemonic", "nomenclature", "product", "route"] as const)(
    "blocks owner approval and accepts current SME approval for %s",
    (family) => {
      const target = targets.find((candidate) => candidate.family === family);
      if (!target) throw new Error(`Missing ${family} target.`);
      expect(summarizeSmeReviewCoverage([target], content.reviewers).pending).toEqual([target.id]);

      const reviewed = {
        ...target,
        status: "reviewed",
        reviewedBy: sme.id,
        reviewedAt: "2026-09-25",
        reviewFingerprint: createReviewFingerprint(target.fingerprintInput),
      };
      expect(summarizeSmeReviewCoverage([reviewed], content.reviewers).smeReviewed).toEqual([
        target.id,
      ]);
      expect(findReviewFingerprintProblems([reviewed], content.reviewers)).toEqual([]);
      const schema = {
        "alternate-mnemonic": alternateGroupMnemonicRecordSchema,
        nomenclature: nomenclatureRecordSchema,
        product: preparationProductionProductSchema,
        route: preparationProductionRouteSchema,
      }[family];
      expect(schema.safeParse(reviewed).success).toBe(true);
      expect(
        summarizeSmeReviewCoverage(
          [
            {
              ...reviewed,
              fingerprintInput: { ...target.fingerprintInput, fixtureScientificChange: "changed" },
            },
          ],
          content.reviewers,
        ).pending,
      ).toEqual([target.id]);
    },
  );

  it("invalidates a route review when parent source attribution changes", () => {
    const route = targets.find((candidate) => candidate.family === "route");
    if (!route) throw new Error("Missing route target.");
    const approved = {
      ...route,
      status: "reviewed",
      reviewedBy: sme.id,
      reviewedAt: "2026-09-25",
      reviewFingerprint: createReviewFingerprint(route.fingerprintInput),
    };
    expect(
      findReviewFingerprintProblems(
        [
          {
            ...approved,
            fingerprintInput: {
              ...route.fingerprintInput,
              parent: { sources: [{ title: "Revised", locator: "https://example.test" }] },
            },
          },
        ],
        content.reviewers,
      ),
    ).toEqual([{ code: "stale_review_fingerprint", recordId: route.id }]);
  });
});
