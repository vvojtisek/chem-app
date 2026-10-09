import { readFile } from "node:fs/promises";

import { balancingReactionCollectionSchema } from "./balancing-reactions-schema";
import type { AuthoringContent } from "./authoring-content";
import { nomenclatureCollectionSchema } from "./nomenclature-schema";
import { preparationProductionCollectionSchema } from "./preparation-production-schema";
import type { ReviewableRecord } from "./review";

export interface ReleaseReviewTarget extends ReviewableRecord {
  readonly family:
    | "element"
    | "group"
    | "alternate-mnemonic"
    | "nomenclature"
    | "product"
    | "route"
    | "balancing-reaction";
  readonly fingerprintInput: object;
}

export async function loadReleaseReviewSources() {
  const [nomenclature, preparationProduction, balancingReactions] = await Promise.all([
    readFile(new URL("../data/nomenclature.json", import.meta.url), "utf8"),
    readFile(new URL("../data/preparation-production.json", import.meta.url), "utf8"),
    readFile(new URL("../data/balancing-reactions.json", import.meta.url), "utf8"),
  ]);
  return {
    nomenclature: nomenclatureCollectionSchema.parse(JSON.parse(nomenclature) as unknown),
    preparationProduction: preparationProductionCollectionSchema.parse(
      JSON.parse(preparationProduction) as unknown,
    ),
    balancingReactions: balancingReactionCollectionSchema.parse(JSON.parse(balancingReactions)),
  };
}

export function collectReleaseReviewTargets(
  content: AuthoringContent,
  sources: Awaited<ReturnType<typeof loadReleaseReviewSources>>,
): readonly ReleaseReviewTarget[] {
  const targets: ReleaseReviewTarget[] = [];
  for (const [family, records] of [
    ["element", content.elements],
    ["group", content.groups],
    ["alternate-mnemonic", content.alternateGroupMnemonics],
    ["nomenclature", sources.nomenclature.records],
  ] as const) {
    for (const record of records) {
      if (
        record.status === "draft" ||
        record.status === "in-review" ||
        record.status === "deprecated"
      )
        continue;
      targets.push({ ...record, family, fingerprintInput: record });
    }
  }

  for (const product of sources.preparationProduction.products) {
    if (product.status === "deprecated") continue;
    const { routes, ...productWithoutRoutes } = product;
    targets.push({ ...product, family: "product", fingerprintInput: productWithoutRoutes });
    for (const route of routes) {
      if (route.status === "in-review" || route.status === "deprecated") continue;
      // The route attestation also covers the product identity and cited source.
      // Reviewing a sibling route cannot invalidate this route's fingerprint.
      targets.push({
        ...route,
        family: "route",
        fingerprintInput: {
          ...route,
          parent: {
            id: product.id,
            nameCs: product.nameCs,
            formula: product.formula,
            sources: product.sources,
          },
        },
      });
    }
  }
  for (const lesson of sources.balancingReactions.lessons) {
    if (lesson.status === "in-review") continue;
    targets.push({
      ...lesson,
      family: "balancing-reaction",
      fingerprintInput: lesson,
    });
  }
  return targets;
}
