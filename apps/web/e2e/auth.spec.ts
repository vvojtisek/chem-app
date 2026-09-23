import { expect, type Page, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const username = process.env.SEED_USER_USERNAME ?? "user";
const password = process.env.SEED_USER_PASSWORD ?? "CiOnlyUser_2026_ABCDE";
const webOrigin =
  process.env.WEB_E2E_ORIGIN ?? `http://localhost:${process.env.WEB_E2E_PORT ?? "3000"}`;

test("redirects without a session and shows an accessible invalid-login error", async ({
  page,
}) => {
  await page.goto("/procvicovani");
  await expect(page).toHaveURL(/\/login\?next=%2Fprocvicovani/);
  await page.getByRole("textbox", { name: "Uživatelské jméno" }).fill(username);
  await page.getByLabel("Heslo").fill("incorrect-credential");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page.locator("p[role='alert']")).toContainText("jméno nebo heslo");
});

test("logs in, reaches the requested route, and logs out", async ({ page }) => {
  await page.goto("/procvicovani");
  await page.getByRole("textbox", { name: "Uživatelské jméno" }).fill(username);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/procvicovani$/);
  await page
    .getByRole("navigation", { name: "Navigace účtu" })
    .getByRole("link", { name: username })
    .click();
  await page.getByRole("button", { name: "Odhlásit", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/procvicovani");
  await expect(page).toHaveURL(/\/login\?next=%2Fprocvicovani/);
});

test("denies the administration page to a regular user", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Uživatelské jméno" }).fill(username);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Přístup odepřen" })).toBeVisible();
});

test("allows the administration page to an administrator", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Uživatelské jméno" })
    .fill(process.env.SEED_ADMIN_USERNAME ?? "admin");
  await page.getByLabel("Heslo").fill(process.env.SEED_ADMIN_PASSWORD ?? "CiOnlyAdmin_2026_ABCDE");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Správa účtů" })).toBeVisible();
  await expect(page.getByRole("list").first()).toContainText(username);
});

test("opens cached learning after a verified session goes offline", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Uživatelské jméno" }).fill(username);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto("/procvicovani/nazvoslovi", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Procvičování: Názvosloví" })).toBeVisible();
  await expect(page.getByText(/Offline · čeká/)).toBeVisible();
});

async function attemptIds(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const marker = JSON.parse(localStorage.getItem("inorganic.verified-account") ?? "null") as {
      userId?: string;
    } | null;
    if (!marker?.userId) return [];
    const request = indexedDB.open(`inorganic-learning.${marker.userId}`);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("attempt-events", "readonly");
      const keys = transaction.objectStore("attempt-events").getAllKeys();
      return await new Promise<string[]>((resolve, reject) => {
        keys.onsuccess = () => resolve(keys.result.map(String));
        keys.onerror = () => reject(keys.error);
      });
    } finally {
      database.close();
    }
  });
}

test("syncs an offline attempt and pulls it into another browser context", async ({ browser }) => {
  const first = await browser.newContext({
    baseURL: webOrigin,
    storageState: ".auth/user.json",
  });
  const second = await browser.newContext({
    baseURL: webOrigin,
    storageState: ".auth/user.json",
  });
  try {
    const firstPage = await first.newPage();
    await firstPage.goto("/procvicovani/prvky");
    await firstPage.getByRole("button", { name: /^Přejít na cvičení/ }).click();
    await first.setOffline(true);
    await firstPage.getByRole("textbox", { name: "Značka prvku" }).fill("H");
    await firstPage.getByRole("textbox", { name: "Značka prvku" }).press("Enter");
    await expect.poll(async () => (await attemptIds(firstPage)).length).toBeGreaterThan(0);
    const [attemptId] = await attemptIds(firstPage);
    expect(attemptId).toBeTruthy();
    await expect(firstPage.getByText(/Offline · čeká 1/)).toBeVisible();
    await first.setOffline(false);
    await expect(firstPage.getByText("Synchronizováno", { exact: true })).toBeVisible();

    const secondPage = await second.newPage();
    await secondPage.goto("/ucet");
    await expect
      .poll(async () => (await attemptIds(secondPage)).includes(attemptId ?? ""))
      .toBe(true);
  } finally {
    await first.close();
    await second.close();
  }
});
