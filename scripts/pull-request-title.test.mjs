import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePullRequestTitle } from "./pull-request-title.mjs";

describe("parsePullRequestTitle", () => {
  it("maps types to release impact", () => {
    const cases = [
      ["feat: add flashcards", "minor"],
      ["fix: keep progress after logout", "patch"],
      ["perf(web): cache element tiles", "patch"],
      ["revert: undo practice timer", "patch"],
      ["chore(deps): bump vitest", "none"],
      ["docs: describe releases", "none"],
      ["ci: pin actions", "none"],
      ["refactor(chemistry): split balancing", "none"],
    ];
    for (const [title, releaseImpact] of cases) {
      const result = parsePullRequestTitle(title);
      assert.equal(result.valid, true, title);
      assert.equal(result.releaseImpact, releaseImpact, title);
    }
  });

  it("treats an exclamation mark as a breaking change for any type", () => {
    assert.deepEqual(parsePullRequestTitle("feat(api)!: require sign-in for progress"), {
      valid: true,
      type: "feat",
      scope: "api",
      breaking: true,
      releaseImpact: "major",
    });
    assert.equal(parsePullRequestTitle("chore!: drop offline schema v1").releaseImpact, "major");
  });

  it("accepts scopes used in this repository", () => {
    for (const title of [
      "feat(periodic-table): add heatmap",
      "fix(deps): patch next",
      "fix(web/e2e): stabilise login",
    ]) {
      assert.equal(parsePullRequestTitle(title).valid, true, title);
    }
  });

  it("rejects titles that release-please would ignore or misread", () => {
    for (const title of [
      "Feat/deploy aws vscht frankfurt",
      "v1.1: practice/learning refactor",
      "Merge pull request #6 from vvojtisek/main",
      'Revert "feat: add flashcards"',
      "feature: add flashcards",
      "bug: fix logout",
      "Fix: capitalised type",
      "fix:missing space",
      "fix: ",
      "fix(): empty scope",
      "fix(API): uppercase scope",
      "fix: trailing space ",
      "fix !: space before bang",
    ]) {
      assert.equal(parsePullRequestTitle(title).valid, false, title);
    }
  });
});
