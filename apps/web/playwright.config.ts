import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.WEB_E2E_PORT ?? "3000";
const apiPort = process.env.API_E2E_PORT ?? "8000";
const webOrigin = process.env.WEB_E2E_ORIGIN ?? `http://localhost:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: webOrigin,
    trace: "on-first-retry",
    storageState: ".auth/user.json",
  },
  globalSetup: "./e2e/global-setup.ts",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: `uv --directory ../api run uvicorn inorganic_api.main:app --host 127.0.0.1 --port ${apiPort}`,
      url: `${apiOrigin}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm start --port ${webPort}`,
      url: `${webOrigin}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
