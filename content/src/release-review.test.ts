import { describe, expect, it } from "vitest";
import { balancingReactionLessonSchema } from "./balancing-reactions-schema";
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
    expect(counts.get("balancing-reaction")).toBe(sources.balancingReactions.lessons.length);
    expect(targets).not.toContainEqual(expect.objectContaining({ status: "in-review" }));
  });

  it.each([
    "alternate-mnemonic",
    "nomenclature",
    "product",
    "route",
    "balancing-reaction",
  ] as const)("blocks owner approval and accepts current SME approval for %s", (family) => {
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
      "balancing-reaction": balancingReactionLessonSchema,
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
  });

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

  it("excludes deprecated products and routes from the release gate", () => {
    const [first] = sources.preparationProduction.products;
    if (!first) throw new Error("Missing preparation fixture product.");
    const [firstRoute] = first.routes;
    if (!firstRoute) throw new Error("Missing preparation fixture route.");
    const deprecatedRoute = { ...firstRoute, status: "deprecated" as const };
    const withDeprecations = {
      ...sources,
      preparationProduction: {
        ...sources.preparationProduction,
        products: sources.preparationProduction.products.map((product, index) =>
          index === 0
            ? { ...product, routes: [deprecatedRoute, ...product.routes.slice(1)] }
            : index === 1
              ? { ...product, status: "deprecated" as const }
              : product,
        ),
      },
    };
    const second = sources.preparationProduction.products[1];
    if (!second) throw new Error("Missing second preparation fixture product.");
    const ids = new Set(collectReleaseReviewTargets(content, withDeprecations).map(({ id }) => id));
    expect(ids.has(firstRoute.id)).toBe(false);
    expect(ids.has(first.id)).toBe(true);
    expect(ids.has(second.id)).toBe(false);
    for (const route of second.routes) expect(ids.has(route.id)).toBe(false);
  });
});
