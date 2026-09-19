import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const committedDirectory = resolve(root, "packages/contracts");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "inorganic-contracts-"));

try {
  const openApiPath = join(temporaryDirectory, "openapi.json");
  const schemaPath = join(temporaryDirectory, "schema.d.ts");

  execFileSync(
    "uv",
    [
      "--directory",
      resolve(root, "apps/api"),
      "run",
      "python",
      "scripts/export_openapi.py",
      "--output",
      openApiPath,
    ],
    { stdio: "inherit" },
  );
  execFileSync("pnpm", ["exec", "openapi-typescript", openApiPath, "--output", schemaPath], {
    cwd: root,
    stdio: "inherit",
  });

  const pairs = [
    [resolve(committedDirectory, "openapi.json"), openApiPath],
    [resolve(committedDirectory, "src/schema.d.ts"), schemaPath],
  ];

  for (const [committed, generated] of pairs) {
    if (readFileSync(committed, "utf8") !== readFileSync(generated, "utf8")) {
      throw new Error(`Generated contract is stale: ${committed}. Run pnpm contracts:generate.`);
    }
  }

  console.log("OpenAPI and generated TypeScript contracts are current.");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
