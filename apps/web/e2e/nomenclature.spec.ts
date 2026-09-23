import { readFileSync } from "node:fs";
import { nomenclatureSnapshotSchema } from "@inorganic/content/nomenclature-schema";
import { expect, test, type Page } from "@playwright/test";

const snapshot = nomenclatureSnapshotSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../content/generated/nomenclature-runtime.json", import.meta.url),
      "utf8",
    ),
  ) as unknown,
);

const byFormula = new Map(snapshot.compounds.map((compound) => [compound.formula, compound]));
const byName = new Map(snapshot.compounds.map((compound) => [compound.nameCs, compound]));

async function currentAnswer(page: Page, direction: "formula-to-name" | "name-to-formula") {
  const prompt = await page.locator('p[role="img"]').getAttribute("aria-label");
  if (!prompt) throw new Error("The nomenclature prompt is missing its accessible text.");
  const compound = direction === "formula-to-name" ? byFormula.get(prompt) : byName.get(prompt);
  if (!compound) throw new Error(`Unknown nomenclature prompt: ${prompt}`);
  return compound;
}

async function answerCurrent(page: Page, direction: "formula-to-name" | "name-to-formula") {
  const compound = await currentAnswer(page, direction);
  const label = direction === "formula-to-name" ? "Český název" : "Chemický vzorec";
  await page
    .getByLabel(label)
    .fill(direction === "formula-to-name" ? compound.nameCs : compound.formula);
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
  await page.getByRole("button", { name: "Pokračovat" }).click();
}

test("opens owner-approved practice at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("link", { name: /Procvičit názvosloví/i }).click();
  await expect(page).toHaveURL(/\/procvicovani\/nazvoslovi$/);
  await expect(page.getByRole("heading", { name: "Názvosloví" })).toBeVisible();
  await expect(page.getByText(/Vlastník projektu ji zkontroloval orientačně/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Začít cvičení" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("completes formula-to-name practice with initial accuracy", async ({ page }) => {
  await page.goto("/procvicovani/nazvoslovi");
  await page.getByRole("button", { name: "Začít cvičení" }).click();
  for (let index = 0; index < 10; index += 1) {
    await answerCurrent(page, "formula-to-name");
  }
  await expect(page.getByRole("heading", { name: "Cvičení dokončeno" })).toBeVisible();
  await expect(page.getByText(/Úspěšnost prvního průchodu: 100 %/)).toBeVisible();
});

test("retries one incorrect name without inflating initial accuracy", async ({ page }) => {
  await page.goto("/procvicovani/nazvoslovi");
  await page.getByRole("button", { name: "Začít cvičení" }).click();
  const first = await currentAnswer(page, "formula-to-name");
  await page.getByLabel("Český název").fill("zcela chybný název");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("heading", { name: "Nesprávně" })).toBeVisible();
  await page.getByRole("button", { name: "Pokračovat" }).click();
  for (let index = 1; index < 10; index += 1) {
    await answerCurrent(page, "formula-to-name");
  }
  await expect(page.getByText(/Opakování chyby/)).toBeVisible();
  expect((await currentAnswer(page, "formula-to-name")).id).toBe(first.id);
  await answerCurrent(page, "formula-to-name");
  await expect(page.getByText(/Úspěšnost prvního průchodu: 90 %/)).toBeVisible();
});

test("completes name-to-formula practice with a live preview", async ({ page }) => {
  await page.goto("/procvicovani/nazvoslovi");
  await page.getByLabel("Název → vzorec").check();
  await page.getByRole("button", { name: "Začít cvičení" }).click();
  for (let index = 0; index < 10; index += 1) {
    const compound = await currentAnswer(page, "name-to-formula");
    await page.getByLabel("Chemický vzorec").fill(compound.formula);
    await expect(page.getByText("Náhled vzorce:")).toBeVisible();
    await page.getByRole("button", { name: "Vyhodnotit" }).click();
    await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
    await page.getByRole("button", { name: "Pokračovat" }).click();
  }
  await expect(page.getByText(/Úspěšnost prvního průchodu: 100 %/)).toBeVisible();
});

test("retries an incorrect formula after the initial round", async ({ page }) => {
  await page.goto("/procvicovani/nazvoslovi");
  await page.getByLabel("Název → vzorec").check();
  await page.getByRole("button", { name: "Začít cvičení" }).click();
  const first = await currentAnswer(page, "name-to-formula");
  await page.getByLabel("Chemický vzorec").fill("H2O");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("heading", { name: "Nesprávně" })).toBeVisible();
  await page.getByRole("button", { name: "Pokračovat" }).click();
  for (let index = 1; index < 10; index += 1) {
    await answerCurrent(page, "name-to-formula");
  }
  await expect(page.getByText(/Opakování chyby/)).toBeVisible();
  expect((await currentAnswer(page, "name-to-formula")).id).toBe(first.id);
  await answerCurrent(page, "name-to-formula");
  await expect(page.getByText(/Úspěšnost prvního průchodu: 90 %/)).toBeVisible();
});

test("opens and resumes nomenclature offline", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.goto("/procvicovani/nazvoslovi");
  await page.getByRole("button", { name: "Začít cvičení" }).click();
  const first = await currentAnswer(page, "formula-to-name");
  await page.getByLabel("Český název").fill(first.nameCs);
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const request = indexedDB.open("inorganic-learning", 4);
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction("nomenclature-sessions", "readonly");
        const value = await new Promise<unknown>((resolve, reject) => {
          const get = transaction.objectStore("nomenclature-sessions").get("active");
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => reject(get.error);
        });
        database.close();
        return typeof value === "object" && value !== null && "input" in value ? value.input : null;
      }),
    )
    .toBe(first.nameCs);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Český název")).toHaveValue(first.nameCs);
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
});

test("starts nomenclature offline after opening only the home page", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto("/procvicovani/nazvoslovi", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Názvosloví" })).toBeVisible();
  await page.getByRole("button", { name: "Začít cvičení" }).click();
  await expect(page.getByLabel("Český název")).toBeVisible();
});
