import { expect, test } from "@playwright/test";

test("starts and hydrates learning modes offline after one home visit", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await context.setOffline(true);

  await page.goto("/procvicovani/periodicka-tabulka", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Přejít na cvičení (90 prvků)" }).click();
  await expect(page.getByRole("heading", { name: /^Hledaný prvek:/ })).toBeVisible();
  await page
    .getByRole("region", { name: "Periodická tabulka" })
    .getByRole("button", { name: "Perioda 1, skupina 1", exact: true })
    .click();
  await expect(page.getByText(/Správně: 1|Špatně: 1/)).toBeVisible();

  await page.goto("/procvicovani/nazvoslovi", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Procvičování: Názvosloví");
  await page.getByRole("button", { name: /^Spustit cvičení/ }).click();
  await expect(page.getByRole("heading", { name: /^Zadání:/ })).toBeVisible();

  await page.goto("/procvicovani/rovnice", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Chemické rovnice" })).toBeVisible();
  await page.getByRole("button", { name: "Vyhodnotit koeficienty" }).click();
  await expect(page.getByText("To není správné řešení.")).toBeVisible();
  await page.getByRole("button", { name: "Zkusit znovu" }).click();
  await expect(page.getByRole("button", { name: "Vyhodnotit koeficienty" })).toBeVisible();

  await page.goto("/flashcards/prvky", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Prvky" })).toBeVisible();
  await page.getByRole("button", { name: "Otočit kartu" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Vodík" })).toBeVisible();
});
