import { readFileSync } from "node:fs";
import { nomenclatureSnapshotSchema } from "@inorganic/content/nomenclature-schema";
import { expect, type Page, test } from "@playwright/test";

const snapshot = nomenclatureSnapshotSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../content/generated/nomenclature-runtime.json", import.meta.url),
      "utf8",
    ),
  ) as unknown,
);

type Compound = (typeof snapshot.compounds)[number];

function plainFormula(compound: Compound): string {
  if (compound.charge === 0) return compound.formula;
  const magnitude = Math.abs(compound.charge);
  return `${compound.formula} ${magnitude === 1 ? "" : magnitude}${compound.charge > 0 ? "+" : "-"}`;
}

const byFormula = new Map(snapshot.compounds.map((compound) => [plainFormula(compound), compound]));
const byName = new Map(
  snapshot.compounds
    .filter((compound) => compound.directions.includes("name-to-formula"))
    .map((compound) => [compound.nameCs, compound]),
);
const hydroxides = snapshot.compounds.filter((compound) => compound.category === "hydroxide");

async function currentCompound(page: Page): Promise<{ compound: Compound; byFormula: boolean }> {
  const heading = page.getByRole("heading", { name: /^Zadání:/ });
  const formula = heading.getByRole("img");
  if ((await formula.count()) > 0) {
    const label = await formula.getAttribute("aria-label");
    const compound = label ? byFormula.get(label) : undefined;
    if (!compound) throw new Error(`Unknown formula prompt: ${label}`);
    return { compound, byFormula: true };
  }
  const name = ((await heading.textContent()) ?? "").replace(/^Zadání:\s*/u, "").trim();
  const compound = byName.get(name);
  if (!compound) throw new Error(`Unknown name prompt: ${name}`);
  return { compound, byFormula: false };
}

async function answerCurrent(page: Page): Promise<Compound> {
  const { compound, byFormula: askedByFormula } = await currentCompound(page);
  const input = page.getByRole("textbox", {
    name: askedByFormula ? "Český název" : "Chemický vzorec",
  });
  await input.fill(askedByFormula ? compound.nameCs : compound.formula);
  await input.press("Enter");
  return compound;
}

async function chooseOnly(page: Page, category: RegExp): Promise<void> {
  await page.getByRole("button", { name: "Zrušit výběr" }).click();
  await page.getByRole("button", { name: category }).click();
}

function countLabel(count: number): string {
  if (count === 1) return `${count} sloučenina`;
  if (count >= 2 && count <= 4) return `${count} sloučeniny`;
  return `${count} sloučenin`;
}

test("opens the compact nomenclature filters at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("link", { name: /Procvičit názvosloví/i }).click();
  await expect(page).toHaveURL(/\/procvicovani\/nazvoslovi$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Procvičování: Názvosloví");
  await expect(page.getByText(/Chyby se na konci série|zkontroloval orientačně/)).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: `Spustit cvičení (${countLabel(snapshot.compounds.length)})`,
    }),
  ).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("combines category and element-count filters and blocks an empty combination", async ({
  page,
}) => {
  await page.goto("/procvicovani/nazvoslovi");
  await chooseOnly(page, /^✓?\s*Hydroxidy/);
  await expect(
    page.getByRole("button", { name: `Spustit cvičení (${countLabel(hydroxides.length)})` }),
  ).toBeEnabled();
  await page.getByText("1", { exact: true }).click();
  await expect(page.getByRole("button", { name: /^Spustit cvičení/ })).toBeDisabled();
  await expect(page.getByText(/neodpovídá žádná látka/)).toBeVisible();
  await page.getByText("Všechny", { exact: true }).click();
  await expect(page.getByRole("button", { name: /^Spustit cvičení/ })).toBeEnabled();
});

test("completes a filtered formula-to-name practice with direct answers", async ({ page }) => {
  await page.goto("/procvicovani/nazvoslovi");
  await chooseOnly(page, /^✓?\s*Hydroxidy/);
  await page.getByRole("button", { name: /^Spustit cvičení/ }).click();
  await expect(page.getByRole("textbox", { name: "Český název" })).toBeFocused();

  for (let index = 0; index < hydroxides.length; index += 1) {
    await answerCurrent(page);
    await expect(page.getByText(`Správně: ${index + 1}`, { exact: true })).toBeVisible();
  }

  const summary = page.getByRole("region", { name: "Vyhodnocení cvičení" });
  await expect(summary.getByText(`${hydroxides.length} z ${hydroxides.length}`)).toBeVisible();
  await expect(summary.getByText("100 %")).toBeVisible();
});

test("accepts a hydrate name without diacritics or spaces", async ({ page }) => {
  const hydrate = snapshot.compounds.find(
    (compound) => compound.tags.includes("hydrate") && compound.category === "oxoacid-salt",
  );
  if (!hydrate) throw new Error("The snapshot has no published oxoacid-salt hydrate.");
  await page.goto("/procvicovani/nazvoslovi");
  await chooseOnly(page, /^✓?\s*Soli kyslíkatých kyselin/);
  await page.getByText("4 a více", { exact: true }).click();
  await page.getByRole("button", { name: /^Spustit cvičení/ }).click();

  for (;;) {
    const { compound } = await currentCompound(page);
    const input = page.getByRole("textbox", { name: "Český název" });
    if (compound.id === hydrate.id) {
      const compact = compound.nameCs
        .normalize("NFD")
        .replaceAll(/\p{M}/gu, "")
        .replaceAll(" ", "")
        .toUpperCase();
      await input.fill(compact);
      await input.press("Enter");
      await expect(
        page.getByText(`Přesný zápis: ${compound.nameCs}.`, { exact: false }),
      ).toBeVisible();
      break;
    }
    await input.fill(compound.nameCs);
    await input.press("Enter");
  }
  await expect(page.getByText("Špatně: 0", { exact: true })).toBeVisible();
});

test("asks a wrongly named compound again at the end of the queue", async ({ page }) => {
  await page.goto("/procvicovani/nazvoslovi");
  await chooseOnly(page, /^✓?\s*Hydroxidy/);
  await page.getByRole("button", { name: /^Spustit cvičení/ }).click();

  const { compound: first } = await currentCompound(page);
  await page.getByRole("textbox", { name: "Český název" }).fill("zcela chybný název");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Špatně: 1", { exact: true })).toBeVisible();
  await expect(page.getByText(`= ${first.nameCs}.`, { exact: false }).first()).toBeVisible();

  for (let index = 1; index < hydroxides.length; index += 1) await answerCurrent(page);
  expect((await currentCompound(page)).compound.id).toBe(first.id);
  await answerCurrent(page);
  await expect(page.getByRole("region", { name: "Vyhodnocení cvičení" })).toBeVisible();
});

test("answers formulas in the name-to-formula direction with a live preview", async ({ page }) => {
  await page.goto("/procvicovani/nazvoslovi");
  await chooseOnly(page, /^✓?\s*Hydroxidy/);
  await page.getByRole("button", { name: /^Spustit cvičení/ }).click();
  await page.getByText("Název → Vzorec", { exact: true }).click();

  const { compound } = await currentCompound(page);
  await page.getByRole("textbox", { name: "Chemický vzorec" }).fill(compound.formula);
  await expect(page.getByText(/Náhled/)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Správně: 1", { exact: true })).toBeVisible();
});

test("resumes an unfinished nomenclature practice offline", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.goto("/procvicovani/nazvoslovi");
  await chooseOnly(page, /^✓?\s*Hydroxidy/);
  await page.getByRole("button", { name: /^Spustit cvičení/ }).click();
  await answerCurrent(page);
  const { compound: next } = await currentCompound(page);
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const request = indexedDB.open("inorganic-learning");
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
        return typeof value === "object" && value !== null && "correct" in value
          ? value.correct
          : null;
      }),
    )
    .toBe(1);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Správně: 1", { exact: true })).toBeVisible();
  expect((await currentCompound(page)).compound.id).toBe(next.id);
  await answerCurrent(page);
  await expect(page.getByText("Správně: 2", { exact: true })).toBeVisible();
});

test("starts nomenclature offline after opening only the home page", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto("/procvicovani/nazvoslovi", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Procvičování: Názvosloví");
  await page.getByRole("button", { name: /^Spustit cvičení/ }).click();
  await expect(page.getByRole("heading", { name: /^Zadání:/ })).toBeVisible();
});
