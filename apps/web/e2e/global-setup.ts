import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "@playwright/test";

const webDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const origin =
  process.env.WEB_E2E_ORIGIN ?? `http://localhost:${process.env.WEB_E2E_PORT ?? "3000"}`;

export default async function globalSetup(): Promise<void> {
  const seed = {
    SEED_ADMIN_USERNAME: process.env.SEED_ADMIN_USERNAME ?? "admin",
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD ?? "CiOnlyAdmin_2026_ABCDE",
    SEED_USER_USERNAME: process.env.SEED_USER_USERNAME ?? "user",
    SEED_USER_PASSWORD: process.env.SEED_USER_PASSWORD ?? "CiOnlyUser_2026_ABCDE",
    SEED_TESTER_USERNAME: process.env.SEED_TESTER_USERNAME ?? "tester",
    SEED_TESTER_PASSWORD: process.env.SEED_TESTER_PASSWORD ?? "CiOnlyTester_2026_ABCDE",
  };
  const env = { ...process.env, ...seed, APP_ENV: "test", PUBLIC_ORIGIN: origin };
  execFileSync("uv", ["--directory", "../api", "run", "alembic", "upgrade", "head"], {
    cwd: webDirectory,
    env,
    stdio: "inherit",
  });
  const resetLoginThrottle = [
    "from sqlalchemy import delete",
    "from sqlalchemy.engine import make_url",
    "from inorganic_api.config import get_settings",
    "from inorganic_api.database import get_engine",
    "from inorganic_api.models.auth import LoginThrottle",
    "settings = get_settings()",
    "database_name = make_url(settings.database_url).database or ''",
    "if not (database_name.startswith('test_') or database_name.endswith('_test')): raise SystemExit('E2E database must use a test_ prefix or _test suffix')",
    "with get_engine().begin() as connection:",
    "    connection.execute(delete(LoginThrottle))",
  ].join("\n");
  execFileSync("uv", ["--directory", "../api", "run", "python", "-c", resetLoginThrottle], {
    cwd: webDirectory,
    env,
    stdio: "inherit",
  });
  execFileSync(
    "uv",
    ["--directory", "../api", "run", "python", "-m", "inorganic_api.cli", "seed-accounts"],
    { cwd: webDirectory, env, stdio: "inherit" },
  );
  const resetAccounts = ["reset_chromium", "reset_mobile_chromium"];
  const seedResetAccounts = [
    "from sqlalchemy import select",
    "from inorganic_api.database import create_session_factory",
    "from inorganic_api.models import User",
    "from inorganic_api.services.passwords import hash_password",
    "import os",
    "names = os.environ['E2E_RESET_ACCOUNTS'].split(',')",
    "with create_session_factory()() as db:",
    "    for name in names:",
    "        if db.scalar(select(User).where(User.username == name)) is None:",
    "            db.add(User(username=name, password_hash=hash_password(os.environ['E2E_RESET_PASSWORD']), role='user'))",
    "    db.commit()",
  ].join("\n");
  execFileSync("uv", ["--directory", "../api", "run", "python", "-c", seedResetAccounts], {
    cwd: webDirectory,
    env: {
      ...env,
      E2E_RESET_ACCOUNTS: resetAccounts.join(","),
      E2E_RESET_PASSWORD: process.env.E2E_RESET_PASSWORD ?? "CiOnlyReset_2026_ABCDE",
    },
    stdio: "inherit",
  });
  const context = await request.newContext({ baseURL: origin });
  try {
    const response = await context.post("/api/v1/auth/login", {
      data: { username: seed.SEED_USER_USERNAME, password: seed.SEED_USER_PASSWORD },
      headers: { Origin: origin },
    });
    if (!response.ok()) throw new Error(`E2E user login failed: HTTP ${response.status()}`);
    const directory = path.join(webDirectory, ".auth");
    await mkdir(directory, { recursive: true });
    await context.storageState({ path: path.join(directory, "user.json") });
  } finally {
    await context.dispose();
  }
}
