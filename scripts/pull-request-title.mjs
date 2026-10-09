// Pull request titles become the squash-merge commit subject on main, and
// release-please derives the next version from those subjects. Keep the type
// list and release impact aligned with release-please's defaults.
export const PULL_REQUEST_TYPES = Object.freeze([
  "feat",
  "fix",
  "perf",
  "revert",
  "refactor",
  "docs",
  "test",
  "build",
  "ci",
  "chore",
  "style",
]);

const MINOR_TYPES = new Set(["feat"]);
const PATCH_TYPES = new Set(["fix", "perf", "revert"]);

const TITLE_PATTERN = new RegExp(
  `^(?<type>${PULL_REQUEST_TYPES.join("|")})` +
    "(?:\\((?<scope>[a-z0-9][a-z0-9._/-]*)\\))?" +
    "(?<breaking>!)?" +
    ": (?<description>\\S.*)$",
);

const EXPECTED_FORMAT = "<type>(<optional scope>)<optional !>: <description>";

/**
 * @param {string} title
 * @returns {{ valid: true, type: string, scope: string | undefined, breaking: boolean,
 *   releaseImpact: "major" | "minor" | "patch" | "none" }
 *   | { valid: false, reason: string }}
 */
export function parsePullRequestTitle(title) {
  const match = TITLE_PATTERN.exec(title);
  if (match?.groups === undefined) {
    return {
      valid: false,
      reason:
        `Expected "${EXPECTED_FORMAT}" with type one of: ${PULL_REQUEST_TYPES.join(", ")}. ` +
        'Example: "fix(api): reject expired reset tokens".',
    };
  }
  if (match.groups.description !== match.groups.description.trimEnd()) {
    return { valid: false, reason: "The description must not end with whitespace." };
  }
  const { type, scope } = match.groups;
  const breaking = match.groups.breaking === "!";
  return { valid: true, type, scope, breaking, releaseImpact: releaseImpactOf(type, breaking) };
}

function releaseImpactOf(type, breaking) {
  if (breaking) {
    return "major";
  }
  if (MINOR_TYPES.has(type)) {
    return "minor";
  }
  if (PATCH_TYPES.has(type)) {
    return "patch";
  }
  return "none";
}
