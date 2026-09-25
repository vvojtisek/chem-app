import { expect, type Page, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const webOrigin =
  process.env.WEB_E2E_ORIGIN ?? `http://localhost:${process.env.WEB_E2E_PORT ?? "3000"}`;
const password = process.env.E2E_RESET_PASSWORD ?? "CiOnlyReset_2026_ABCDE";

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "E-mail nebo uživatelské jméno" }).fill(username);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function answerHydrogen(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.999_999;
  });
  await page.goto("/procvicovani/periodicka-tabulka");
  await page.getByRole("button", { name: "Přejít na cvičení (90 prvků)" }).click();
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Vodík" })).toBeVisible();
  await page
    .getByRole("region", { name: "Periodická tabulka" })
    .getByRole("button", { name: "Perioda 1, skupina 1", exact: true })
    .click();
  await expect(page.getByText("Správně: 1")).toBeVisible();
}

test("confirmed reset clears local mastery and rejects a second device's offline attempt", async ({
  browser,
  page,
  context,
}, testInfo) => {
  const username =
    testInfo.project.name === "mobile-chromium" ? "reset_mobile_chromium" : "reset_chromium";
  const second = await browser.newContext({
    baseURL: webOrigin,
    storageState: { cookies: [], origins: [] },
  });
  try {
    await login(page, username);
    const secondPage = await second.newPage();
    await login(secondPage, username);
    await answerHydrogen(page);
    await secondPage.goto("/procvicovani/periodicka-tabulka");
    await secondPage.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await second.setOffline(true);
    await secondPage.addInitScript(() => {
      Math.random = () => 0.999_999;
    });
    await secondPage.getByRole("button", { name: "Přejít na cvičení (90 prvků)" }).click();
    await secondPage
      .getByRole("region", { name: "Periodická tabulka" })
      .getByRole("button", { name: "Perioda 1, skupina 1", exact: true })
      .click();
    await expect(secondPage.getByText(/Offline · čeká 1/)).toBeVisible();

    await page.goto("/pokrok");
    await expect(page.getByRole("heading", { name: "Zvládnutí periodické tabulky" })).toBeVisible();
    await page.getByRole("button", { name: "Resetovat pokrok" }).click();
    await expect(page.getByText(/vynulovat celý osobní pokrok/)).toBeVisible();
    await page.getByRole("button", { name: "Ano, resetovat pokrok" }).click();
    await expect(page.getByText("Zatím nemáte žádné pokusy z periodické tabulky.")).toBeVisible();
    await expect(page.getByText("Začátečník")).toBeVisible();

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Zatím nemáte žádné pokusy z periodické tabulky.")).toBeVisible();
    await context.setOffline(false);

    await second.setOffline(false);
    await expect(secondPage.getByText("Synchronizováno", { exact: true })).toBeVisible();
    await secondPage.goto("/pokrok");
    await expect(
      secondPage.getByText("Zatím nemáte žádné pokusy z periodické tabulky."),
    ).toBeVisible();
    await expect(secondPage.getByText("Začátečník")).toBeVisible();
  } finally {
    await second.close();
  }
});
