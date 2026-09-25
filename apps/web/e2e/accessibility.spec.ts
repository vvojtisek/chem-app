import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function expectWcag22Aa(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test("account entry screens meet automated WCAG 2.2 AA checks", async ({ browser }) => {
  const baseURL =
    process.env.WEB_E2E_ORIGIN ?? `http://localhost:${process.env.WEB_E2E_PORT ?? "3000"}`;
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Přihlášení" })).toBeVisible();
    await expectWcag22Aa(page);

    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Vytvořit účet" })).toBeVisible();
    await expectWcag22Aa(page);
  } finally {
    await context.close();
  }
});

test("core learner screens meet automated WCAG 2.2 AA checks", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Anorganická chemie" })).toBeVisible();
  await expectWcag22Aa(page);

  await page.goto("/procvicovani/prvky");
  await expect(page.getByRole("heading", { name: "Názvy a značky prvků" })).toBeVisible();
  await expectWcag22Aa(page);
  await page.getByRole("button", { name: "Přejít na cvičení (90 prvků)" }).click();
  await expect(page.getByRole("heading", { name: /^Zadání:/ })).toBeVisible();
  await expectWcag22Aa(page);

  await page.goto("/procvicovani/nazvoslovi");
  await expect(page.getByRole("heading", { name: "Procvičování: Názvosloví" })).toBeVisible();
  await expectWcag22Aa(page);

  await page.goto("/procvicovani/rovnice");
  await expect(page.getByRole("heading", { name: "Chemické rovnice" })).toBeVisible();
  await expectWcag22Aa(page);

  await page.goto("/flashcards/prvky");
  await expect(page.getByRole("heading", { name: "Prvky", exact: true })).toBeVisible();
  await expectWcag22Aa(page);

  await page.goto("/pokrok");
  await expect(page.getByRole("heading", { level: 1, name: "Pokrok" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Zvládnutí periodické tabulky" })).toBeVisible();
  await expectWcag22Aa(page);

  await page.goto("/ucet");
  await expect(page.getByRole("heading", { name: "Profil", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Údaje profilu" })).toBeVisible();
  await expectWcag22Aa(page);
});
