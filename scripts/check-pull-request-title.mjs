import { appendFileSync } from "node:fs";
import { parsePullRequestTitle } from "./pull-request-title.mjs";

// The title is read from the environment, never interpolated into a shell
// command, because pull request titles are untrusted input.
const title = process.env.PULL_REQUEST_TITLE;
if (title === undefined || title === "") {
  console.error("PULL_REQUEST_TITLE is not set.");
  process.exit(2);
}

const result = parsePullRequestTitle(title);
if (!result.valid) {
  console.error(`Pull request title is not a Conventional Commit. ${result.reason}`);
  process.exit(1);
}

const summary = `Release impact when merged: ${result.releaseImpact} (type "${result.type}"${
  result.breaking ? ", breaking" : ""
}).`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
