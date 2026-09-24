import { readFile } from "node:fs/promises";

import { findContentProblems, loadAuthoringContent } from "./authoring-content";
import { createNomenclatureSnapshot, validateNomenclatureRecords } from "./nomenclature-runtime";
import { nomenclatureCollectionSchema } from "./nomenclature-schema";
import { summarizeSmeReviewCoverage } from "./review";
import { preparationProductionCollectionSchema } from "./preparation-production-schema";
import { findPreparationProductionProblems } from "./preparation-production-validation";

const content = await loadAuthoringContent();
const problems = findContentProblems(content);
if (problems.length > 0) {
  throw new Error(`Content validation failed:\n${JSON.stringify(problems, null, 2)}`);
}

const nomenclature = nomenclatureCollectionSchema.parse(
  JSON.parse(
    await readFile(new URL("../data/nomenclature.json", import.meta.url), "utf8"),
  ) as unknown,
);
const elementSymbols = new Set(content.elements.map((element) => element.symbol));
const nomenclatureProblems = validateNomenclatureRecords(nomenclature.records, elementSymbols);
if (nomenclatureProblems.length > 0) {
  throw new Error(
    `Nomenclature validation failed:\n${JSON.stringify(nomenclatureProblems, null, 2)}`,
  );
}

const preparationProduction = preparationProductionCollectionSchema.parse(
  JSON.parse(
    await readFile(new URL("../data/preparation-production.json", import.meta.url), "utf8"),
  ) as unknown,
);
const preparationProductionProblems = findPreparationProductionProblems(
  preparationProduction.products,
  elementSymbols,
);
if (preparationProductionProblems.length > 0) {
  throw new Error(
    `Preparation and production validation failed:\n${JSON.stringify(preparationProductionProblems, null, 2)}`,
  );
}

const expectedSnapshot = createNomenclatureSnapshot(nomenclature.records, elementSymbols);
const generatedSnapshot: unknown = JSON.parse(
  await readFile(new URL("../generated/nomenclature-runtime.json", import.meta.url), "utf8"),
);
if (JSON.stringify(generatedSnapshot) !== JSON.stringify(expectedSnapshot)) {
  throw new Error(
    "Generated nomenclature snapshot is stale; run pnpm --dir content generate:nomenclature.",
  );
}

const reviewedCount = content.elements.filter((element) => element.status === "reviewed").length;
const elementCoverage = summarizeSmeReviewCoverage(content.elements, content.reviewers);
const groupCoverage = summarizeSmeReviewCoverage(content.groups, content.reviewers);
const shippedCount = (coverage: typeof elementCoverage) =>
  coverage.smeReviewed.length + coverage.pending.length;

console.log(
  `Content validation passed: ${content.elements.length} elements (${reviewedCount} reviewed), ${content.groups.length} named groups.`,
);
console.log(
  `Alternative group mnemonics: ${content.alternateGroupMnemonics.length} user-provided records validated.`,
);
console.log(
  `Chemistry-SME review: ${elementCoverage.smeReviewed.length}/${shippedCount(elementCoverage)} shipped elements, ${groupCoverage.smeReviewed.length}/${shippedCount(groupCoverage)} shipped groups. Release gate: pnpm content:release-check.`,
);
console.log(
  `Nomenclature: ${nomenclature.records.length} authored, ${expectedSnapshot.compounds.filter((record) => record.reviewLevel === "owner-approved").length} owner-approved, ${expectedSnapshot.compounds.filter((record) => record.reviewLevel === "sme-reviewed").length} SME-reviewed.`,
);
const equationCount = preparationProduction.products.reduce(
  (total, product) =>
    total + product.routes.filter((route) => route.status === "owner-approved").length,
  0,
);
const unreviewedEquationCount = preparationProduction.products.reduce(
  (total, product) => total + product.routes.filter((route) => route.status === "in-review").length,
  0,
);
console.log(
  `Preparation and production: ${preparationProduction.products.length} products, ${equationCount} validated owner-approved equations, ${unreviewedEquationCount} equation(s) held for review.`,
);
