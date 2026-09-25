import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findContentProblems, loadAuthoringContent } from "./authoring-content";
import { collectReleaseReviewTargets, loadReleaseReviewSources } from "./release-review";
import { summarizeSmeReviewCoverage } from "./review";

execFileSync("pnpm", ["content:validate"], {
  cwd: fileURLToPath(new URL("../../", import.meta.url)),
  stdio: "inherit",
});

const content = await loadAuthoringContent();

if (findContentProblems(content).length > 0) {
  console.error("Release blocked: content validation fails. Run pnpm content:validate.");
  process.exit(1);
}

const targets = collectReleaseReviewTargets(content, await loadReleaseReviewSources());
const coverage = summarizeSmeReviewCoverage(targets, content.reviewers);
const pending = coverage.pending;

const counts = new Map<string, { shipped: number; approved: number }>();
for (const target of targets) {
  const count = counts.get(target.family) ?? { shipped: 0, approved: 0 };
  count.shipped += 1;
  if (coverage.smeReviewed.includes(target.id)) count.approved += 1;
  counts.set(target.family, count);
}
console.log(
  [...counts]
    .map(([family, count]) => `${family}: ${count.approved}/${count.shipped} SME-reviewed`)
    .join("; "),
);

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
