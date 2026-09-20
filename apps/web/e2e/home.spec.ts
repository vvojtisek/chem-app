import { expect, test } from "@playwright/test";

test("shows the four learning modes on desktop and mobile", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Anorganická chemie");
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(4);
});

test("reopens the shell while offline", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Anorganická chemie");
});

test("shows a Czech element card and saves a local edit", async ({ page }) => {
  await page.goto("/flashcards/prvky");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prvky");
  await expect(page.getByText("H", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Otočit kartu" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Vodík");
  await expect(page.getByText(/Mnemotechnika: Helenu Líbal/)).toBeVisible();

  await page.getByRole("button", { name: "Upravit kartu" }).click();
  await page.getByLabel("Český název").fill("Vodík — moje poznámka");
  await expect(page.getByRole("form", { name: "Editor karty prvku" })).toHaveJSProperty(
    "noValidate",
    true,
  );
  await page.getByRole("button", { name: "Uložit lokálně" }).click();

  await expect(page.getByRole("heading", { name: "Vodík — moje poznámka" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Lokální úprava byla uložena");
});

test("practices a Czech element name with immediate feedback", async ({ page }) => {
  await page.goto("/procvicovani/prvky");
  await page.getByRole("button", { name: "Začít cvičení" }).click();
  await expect(page.getByText("H", { exact: true })).toBeVisible();

  await page.getByLabel("Český název").fill("  VODÍK ");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();

  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
  await expect(page.getByText(/H je Vodík/)).toBeVisible();
});

test("accepts a Czech element name without diacritics and gives a hint", async ({ page }) => {
  await page.goto("/procvicovani/prvky");
  await page.getByRole("button", { name: "Začít cvičení" }).click();
  await page.getByLabel("Český název").fill("vodik");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
  await expect(page.getByText(/doplňte českou diakritiku/)).toBeVisible();
});
