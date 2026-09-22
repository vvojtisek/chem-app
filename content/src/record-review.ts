import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { z } from "zod";

import {
  contentFiles,
  findContentProblems,
  loadAuthoringContent,
  readJsonFile,
} from "./authoring-content";
import { applyReviewStamp, createReviewFingerprint } from "./review";

const usage =
  "Usage: pnpm content:record-review --reviewer <reviewer-id> --date <YYYY-MM-DD> (--all | <record-id>...)";
const rawEntriesSchema = z.array(z.record(z.string(), z.unknown()));
const argumentsAfterSeparator = process.argv
  .slice(2)
  .filter((arg, index) => index > 0 || arg !== "--");
const { values, positionals } = parseArgs({
  args: argumentsAfterSeparator,
  options: {
    reviewer: { type: "string" },
    date: { type: "string" },
    all: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

if (!values.reviewer || !values.date || values.all === positionals.length > 0) {
  fail(usage);
}
if (!z.iso.date().safeParse(values.date).success) {
  fail(`--date must be an ISO date (YYYY-MM-DD), got "${values.date}".`);
}

const content = await loadAuthoringContent();
const reviewer = content.reviewers.find(({ id }) => id === values.reviewer);
if (!reviewer) {
  fail(
    `Unknown reviewer "${values.reviewer}". Register the reviewer in content/data/reviewers.json.`,
  );
}
if (reviewer.role !== "chemistry-sme") {
  fail(
    `Reviewer "${reviewer.id}" has role ${reviewer.role}; only a chemistry-sme records reviews.`,
  );
}

const records = [...content.elements, ...content.groups];
const targetIds = new Set(
  values.all
    ? records.filter(({ status }) => status !== "deprecated").map(({ id }) => id)
    : positionals,
);
const knownIds = new Set(records.map(({ id }) => id));
const unknownIds = [...targetIds].filter((id) => !knownIds.has(id));
if (unknownIds.length > 0) {
  fail(`Unknown record IDs: ${unknownIds.join(", ")}`);
}
const deprecatedIds = records
  .filter(({ id, status }) => targetIds.has(id) && status === "deprecated")
  .map(({ id }) => id);
if (deprecatedIds.length > 0) {
  fail(`Deprecated records cannot be marked reviewed: ${deprecatedIds.join(", ")}`);
}

const blockingProblems = findContentProblems(content).filter(
  ({ code, recordId }) =>
    !(
      targetIds.has(recordId) &&
      (code === "stale_review_fingerprint" || code === "missing_review_fingerprint")
    ),
);
if (blockingProblems.length > 0) {
  fail(
    `Resolve content validation problems before recording a review:\n${JSON.stringify(blockingProblems, null, 2)}`,
  );
}

const stamp = {
  reviewerId: reviewer.id,
  reviewedAt: values.date,
  fingerprints: new Map(
    records
      .filter(({ id }) => targetIds.has(id))
      .map((record) => [record.id, createReviewFingerprint(record)]),
  ),
};
const writtenFiles: string[] = [];

for (const file of [contentFiles.elements, contentFiles.groups]) {
  const { entries, updatedIds } = applyReviewStamp(
    rawEntriesSchema.parse(await readJsonFile(file)),
    stamp,
  );
  if (updatedIds.length === 0) continue;

  await writeFile(file, `${JSON.stringify(entries, null, 2)}\n`);
  writtenFiles.push(fileURLToPath(file));
}

execFileSync("pnpm", ["exec", "biome", "format", "--write", ...writtenFiles], {
  cwd: fileURLToPath(new URL("../../", import.meta.url)),
  stdio: "inherit",
});

const remainingProblems = findContentProblems(await loadAuthoringContent());
if (remainingProblems.length > 0) {
  fail(`Recorded review left validation problems:\n${JSON.stringify(remainingProblems, null, 2)}`);
}

console.log(
  `Recorded chemistry-SME review by ${reviewer.name} (${values.date}) for ${targetIds.size} records.`,
);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
