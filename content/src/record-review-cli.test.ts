import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const contentDirectory = fileURLToPath(new URL("../", import.meta.url));
const sourceFiles = [
  "elements.json",
  "groups.json",
  "alternate-group-mnemonics.json",
  "nomenclature.json",
  "preparation-production.json",
];

describe("record-review CLI safety", () => {
  it.each([
    ["unknown ID", "reviewer.vvojtisek", "nomenclature.missing-fixture", "Unknown record IDs"],
    ["non-SME reviewer", "reviewer.project-curriculum", "periodic-group.1", "only a chemistry-sme"],
  ])("rejects %s before changing authoring files", async (_case, reviewer, id, expected) => {
    const before = await Promise.all(
      sourceFiles.map((file) => readFile(new URL(`../data/${file}`, import.meta.url))),
    );
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "src/record-review.ts",
        "--reviewer",
        reviewer,
        "--date",
        "2026-09-25",
        id,
      ],
      { cwd: contentDirectory, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expected);
    const after = await Promise.all(
      sourceFiles.map((file) => readFile(new URL(`../data/${file}`, import.meta.url))),
    );
    expect(after).toEqual(before);
  });
});
