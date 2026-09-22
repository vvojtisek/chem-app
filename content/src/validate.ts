import { findContentProblems, loadAuthoringContent } from "./authoring-content";
import { summarizeSmeReviewCoverage } from "./review";

const content = await loadAuthoringContent();
const problems = findContentProblems(content);

if (problems.length > 0) {
  throw new Error(`Content validation failed:\n${JSON.stringify(problems, null, 2)}`);
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
  `Chemistry-SME review: ${elementCoverage.smeReviewed.length}/${shippedCount(elementCoverage)} shipped elements, ${groupCoverage.smeReviewed.length}/${shippedCount(groupCoverage)} shipped groups. Release gate: pnpm content:release-check.`,
);
