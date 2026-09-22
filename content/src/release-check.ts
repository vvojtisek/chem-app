import { findContentProblems, loadAuthoringContent } from "./authoring-content";
import { summarizeSmeReviewCoverage } from "./review";

const content = await loadAuthoringContent();

if (findContentProblems(content).length > 0) {
  console.error("Release blocked: content validation fails. Run pnpm content:validate.");
  process.exit(1);
}

const pending = [
  ...summarizeSmeReviewCoverage(content.elements, content.reviewers).pending,
  ...summarizeSmeReviewCoverage(content.groups, content.reviewers).pending,
];

if (pending.length > 0) {
  console.error(
    [
      `Release blocked: ${pending.length} shipped records have no current chemistry-SME review.`,
      "A chemistry SME records a review with pnpm content:record-review (docs/chemistry-content.md).",
      ...pending.map((id) => `  ${id}`),
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Release check passed: every shipped record has a current chemistry-SME review.");
