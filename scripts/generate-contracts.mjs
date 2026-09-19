import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const contractsDirectory = resolve(root, "packages/contracts");
const openApiPath = resolve(contractsDirectory, "openapi.json");
const schemaPath = resolve(contractsDirectory, "src/schema.d.ts");

mkdirSync(resolve(contractsDirectory, "src"), { recursive: true });
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
