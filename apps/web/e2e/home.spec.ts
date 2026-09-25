import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

const elements = JSON.parse(
  readFileSync(new URL("../../../content/data/elements.json", import.meta.url), "utf8"),
) as readonly { readonly id: string; readonly nameCs: string; readonly symbol: string }[];
const elementIdByName = new Map(elements.map(({ id, nameCs }) => [nameCs, id]));
const elementSymbolByName = new Map(elements.map(({ nameCs, symbol }) => [nameCs, symbol]));

async function keepQuestionOrder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.999_999;
  });
}

test("shows the three numbered learning modules on desktop and mobile", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Anorganická chemie");
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
  await expect(page.getByText("Offline výuka")).toHaveCount(0);
  await expect(page.getByText("Vyberte, co chcete trénovat")).toHaveCount(0);
  await expect(page.getByText("Příprava MVP")).toHaveCount(0);
});

test("fits the learning modes in an iPad-sized viewport", async ({ page }, testInfo) => {
  await page.goto("/");

  for (const viewport of [
    { name: "landscape", width: 1024, height: 768 },
    { name: "portrait", width: 768, height: 1024 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { level: 1, name: "Anorganická chemie" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
    await expect(page.getByRole("heading", { level: 3 }).last()).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    expect(
      await page.locator("main").evaluate((main) => main.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(viewport.height);

    await page.screenshot({
      path: testInfo.outputPath(`ipad-home-${viewport.name}.png`),
      fullPage: true,
    });
  }
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

test("practices a shuffled element symbol and keeps the editable card library", async ({
  page,
}) => {
  await keepQuestionOrder(page);
  await page.goto("/flashcards/prvky");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Značky prvků");
  await page.getByRole("button", { name: /^Přejít na cvičení/ }).click();
  await expect(page.getByRole("timer")).toHaveText("05:00");
  const card = page.getByRole("article", { name: /^Karta 1 z/ });
  const prompt = await card.getByRole("heading", { level: 2 }).textContent();
  if (!prompt) throw new Error("The first flashcard has no element-name prompt.");
  const symbol = elementSymbolByName.get(prompt);
  if (!symbol) throw new Error(`No symbol found for element "${prompt}".`);
  await card.getByRole("textbox", { name: "Chemická značka" }).fill(symbol);
  await card.getByRole("textbox", { name: "Chemická značka" }).press("Enter");
  await expect(card.getByRole("status")).toHaveText("Správně.");
  await expect(card.getByRole("button", { name: "Další" })).toBeVisible();

  await page.getByText("Prohlížet karty prvků").click();
  await expect(page.getByText("H", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Otočit kartu" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Vodík" })).toBeVisible();
  await expect(page.getByText("Valenční konfigurace")).toBeVisible();

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

test("places a blind periodic-table element inline and moves straight on", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/procvicovani/periodicka-tabulka");
  const url = page.url();
  const table = page.getByRole("region", { name: "Periodická tabulka" });

  await page.getByRole("button", { name: "Přejít na cvičení (90 prvků)" }).click();
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Vodík" })).toBeVisible();
  await expect(page.getByText(/Kam patří|posuňte tabulku/)).toHaveCount(0);
  await expect(table.getByText("?", { exact: true })).toHaveCount(118);

  await table.getByRole("button", { name: "Perioda 1, skupina 1", exact: true }).click();

  await expect(table.getByRole("button", { name: "Perioda 1, skupina 1: H, vyřešeno" })).toHaveText(
    "H",
  );
  await expect(page.getByText("Správně: 1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Helium" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pokračovat" })).toHaveCount(0);
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("completes the whole blind table and asks a missed element again at the end", async ({
  page,
}) => {
  test.slow();
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka");
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  const sought = page.getByRole("heading", { name: /^Hledaný prvek:/ });

  await page.getByRole("button", { name: "Vybrat vše" }).click();
  await page.getByRole("button", { name: "Přejít na cvičení (118 prvků)" }).click();
  await expect(sought).toHaveAccessibleName("Hledaný prvek: Vodík");
  await table.getByRole("button", { name: "Perioda 2, skupina 1", exact: true }).click();
  await expect(page.getByText("Špatně: 1")).toBeVisible();

  for (let placed = 1; placed <= 118; placed += 1) {
    const name = (await sought.textContent())?.replace(/^Hledaný prvek:\s*/u, "").trim() ?? "";
    const elementId = elementIdByName.get(name);
    if (!elementId) throw new Error(`No element named "${name}".`);
    if (placed === 118) expect(name).toBe("Vodík");

    await table.locator(`[data-element-id="${elementId}"]`).click();
    await expect(page.getByText(`Správně: ${placed}`, { exact: true })).toBeVisible();
  }

  const summary = page.getByRole("region", { name: "Vyhodnocení cvičení" });
  await expect(summary).toBeVisible();
  await expect(summary.getByText("118 z 118")).toBeVisible();
  await expect(page.getByText("Špatně: 1")).toBeVisible();
});

test("keeps a wrong blind-table mark for 10 seconds and times the exercise", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.clock.install();
  await page.goto("/procvicovani/periodicka-tabulka");
  const table = page.getByRole("region", { name: "Periodická tabulka" });

  await page.getByRole("button", { name: "Přejít na cvičení (90 prvků)" }).click();
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Vodík" })).toBeVisible();
  await table.getByRole("button", { name: "Perioda 2, skupina 1", exact: true }).click();

  await expect(page.getByText("Špatně: 1")).toBeVisible();
  await expect(
    table.getByRole("button", { name: "Perioda 2, skupina 1: chybná odpověď" }),
  ).toHaveText("✗");
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Helium" })).toBeVisible();

  await page.clock.runFor(9_000);
  await expect(
    table.getByRole("button", { name: "Perioda 2, skupina 1: chybná odpověď" }),
  ).toHaveText("✗");
  await page.clock.runFor(1_000);
  await expect(table.getByRole("button", { name: "Perioda 2, skupina 1", exact: true })).toHaveText(
    "?",
  );
  await expect(page.getByRole("timer")).toHaveText("00:10");

  await page.getByRole("button", { name: "Ukončit" }).click();
  const summary = page.getByRole("region", { name: "Vyhodnocení cvičení" });
  await expect(summary.getByText("0 z 90")).toBeVisible();
  await page.clock.runFor(5_000);
  await expect(page.getByRole("timer")).toHaveText("00:10");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Špatně: 0")).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Vodík" })).toBeVisible();
});

test("completes a selected group by keyboard in the name-to-symbol mode", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  const url = page.url();
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  const input = page.getByRole("textbox", { name: "Značka prvku" });

  await expect(page.getByRole("button", { name: "Přejít na cvičení (90 prvků)" })).toBeVisible();
  await page.getByRole("button", { name: "Zrušit výběr" }).click();
  await table.getByRole("button", { name: "Skupina 18" }).click();
  await page.getByRole("button", { name: "Přejít na cvičení (7 prvků)" }).focus();
  await page.keyboard.press("Enter");

  await expect(input).toBeFocused();
  await expect(page.getByRole("radio", { name: "Název → Značka" })).toBeChecked();
  await expect(table.getByText("?", { exact: true })).toHaveCount(118);

  for (const [period, name, symbol] of [
    [1, "Helium", "He"],
    [2, "Neon", "Ne"],
    [3, "Argon", "Ar"],
    [4, "Krypton", "Kr"],
    [5, "Xenon", "Xe"],
    [6, "Radon", "Rn"],
    [7, "Oganesson", "Og"],
  ] as const) {
    await expect(page.getByRole("heading", { name: `Zadání: ${name}` })).toBeVisible();
    await expect(
      table.getByRole("button", { name: `Perioda ${period}, skupina 18`, exact: true }),
    ).toHaveText("?");
    await expect(input).toBeFocused();
    await page.keyboard.type(symbol);
    await page.keyboard.press("Enter");
    await expect(
      table.getByRole("button", { name: `Perioda ${period}, skupina 18: ${symbol}, vyřešeno` }),
    ).toHaveText(symbol);
  }

  const summary = page.getByRole("region", { name: "Vyhodnocení cvičení" });
  await expect(summary.getByText("7 z 7")).toBeVisible();
  await expect(summary.getByText("100 %")).toBeVisible();
  await expect(page.getByText("Špatně: 0")).toBeVisible();
  expect(page.url()).toBe(url);
});

test("moves on after a wrong name and asks the element again in the symbol-to-name mode", async ({
  page,
}) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  const input = page.getByRole("textbox", { name: "Český název prvku" });

  await page.getByRole("button", { name: "Zrušit výběr" }).click();
  await table.getByRole("button", { name: "Skupina 3" }).click();
  await page.getByRole("button", { name: "Přejít na cvičení (4 prvky)" }).click();
  await page.getByText("Značka → Název", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Značka → Název" })).toBeChecked();

  await expect(page.getByRole("heading", { name: "Zadání: Sc" })).toBeVisible();
  await input.fill("Titan");
  await input.press("Enter");

  await expect(page.getByText("Špatně: 1")).toBeVisible();
  await expect(page.getByText("✗ Špatně: Skandium (Sc).", { exact: true })).toBeVisible();
  await expect(input).toHaveAttribute("data-flash", "incorrect");
  await expect(page.getByRole("heading", { name: "Zadání: Y" })).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();

  for (const [symbol, name] of [
    ["Y", "Yttrium"],
    ["Lu", "lutecium"],
    ["Lr", "Lawrencium"],
    ["Sc", "skandium"],
  ] as const) {
    await expect(page.getByRole("heading", { name: `Zadání: ${symbol}` })).toBeVisible();
    await input.fill(name);
    await input.press("Enter");
  }

  const summary = page.getByRole("region", { name: "Vyhodnocení cvičení" });
  await expect(summary.getByText("4 z 4")).toBeVisible();
  await expect(summary.getByText("80 %")).toBeVisible();
  await expect(
    table.getByRole("button", { name: "Perioda 4, skupina 3: Sc, vyřešeno" }),
  ).toHaveText("Sc");
});

test("restores the element selection and the mode after a reload", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  const lanthanides = table.getByRole("button", { name: "Lanthanidy (La–Yb)" });

  await expect(lanthanides).toHaveAttribute("aria-pressed", "false");
  await lanthanides.click();
  await table.getByRole("button", { name: "Vodík (H)" }).click();
  await expect(page.getByRole("button", { name: "Přejít na cvičení (103 prvků)" })).toBeVisible();
  await page.getByRole("button", { name: "Přejít na cvičení (103 prvků)" }).click();
  await page.getByText("Značka → Název", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Značka → Název" })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Zadání: He" })).toBeVisible();
  await waitForPeriodicCheckpoint(page, "periodic-table-name", "element.002-he", "symbol-to-name");

  await page.reload();

  await expect(page.getByRole("heading", { name: "Zadání: He" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Značka → Název" })).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Český název prvku" })).toBeFocused();
  await page.getByRole("button", { name: "Ukončit" }).click();
  await page.getByRole("button", { name: "Změnit výběr" }).click();
  await expect(page.getByRole("button", { name: "Přejít na cvičení (103 prvků)" })).toBeVisible();
  await expect(lanthanides).toHaveAttribute("aria-pressed", "true");
  await expect(table.getByRole("button", { name: "Vodík (H)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Přejít na cvičení (103 prvků)" }).click();
  await expect(page.getByRole("radio", { name: "Značka → Název" })).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Český název prvku" })).toBeFocused();
});

async function waitForPeriodicCheckpoint(
  page: Page,
  id: string,
  currentId: string,
  mode: string | null = null,
): Promise<void> {
  await page.waitForFunction(
    async ({ sessionId, expectedId, expectedMode }) => {
      const databases = await indexedDB.databases();
      if (!databases.some((database) => database.name === "inorganic-learning")) return false;
      const request = indexedDB.open("inorganic-learning");
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        if (!database.objectStoreNames.contains("nomenclature-sessions")) return false;
        const transaction = database.transaction("nomenclature-sessions", "readonly");
        const value = await new Promise<unknown>((resolve, reject) => {
          const read = transaction.objectStore("nomenclature-sessions").get(sessionId);
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
        });
        return (
          typeof value === "object" &&
          value !== null &&
          "currentId" in value &&
          value.currentId === expectedId &&
          (!expectedMode || ("mode" in value && value.mode === expectedMode))
        );
      } finally {
        database.close();
      }
    },
    { sessionId: id, expectedId: currentId, expectedMode: mode },
  );
}

test("resumes a typed periodic-table retry offline without revealing the earlier answer", async ({
  context,
  page,
}) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  await page.getByRole("button", { name: "Zrušit výběr" }).click();
  await table.getByRole("button", { name: "Vodík (H)" }).click();
  await table.getByRole("button", { name: "Helium (He)" }).click();
  await page.getByRole("button", { name: "Přejít na cvičení (2 prvky)" }).click();
  const input = page.getByRole("textbox", { name: "Značka prvku" });
  await input.fill("X");
  await input.press("Enter");
  await expect(page.getByRole("heading", { name: "Zadání: Helium" })).toBeVisible();
  await waitForPeriodicCheckpoint(page, "periodic-table-name", "element.002-he");

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Zadání: Helium" })).toBeVisible();
  await expect(page.getByText("Špatně: 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Špatně: Vodík (H).")).toHaveCount(0);
  const restoredInput = page.getByRole("textbox", { name: "Značka prvku" });
  await restoredInput.fill("He");
  await restoredInput.press("Enter");
  await expect(page.getByRole("heading", { name: "Zadání: Vodík" })).toBeVisible();
  await restoredInput.fill("H");
  await restoredInput.press("Enter");
  await expect(page.getByRole("region", { name: "Vyhodnocení cvičení" })).toContainText("2 z 2");
});

test("resumes a blind periodic table with solved cells after a reload", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka");
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  await page.getByRole("button", { name: "Zrušit výběr" }).click();
  await table.getByRole("button", { name: "Vodík (H)" }).click();
  await table.getByRole("button", { name: "Helium (He)" }).click();
  await page.getByRole("button", { name: "Přejít na cvičení (2 prvky)" }).click();
  await table.getByRole("button", { name: "Perioda 1, skupina 1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Helium" })).toBeVisible();
  await waitForPeriodicCheckpoint(page, "periodic-table-position", "element.002-he");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Helium" })).toBeVisible();
  await expect(page.getByText("Správně: 1", { exact: true })).toBeVisible();
  await expect(table.getByRole("button", { name: "Perioda 1, skupina 1: H, vyřešeno" })).toHaveText(
    "H",
  );
  await table.getByRole("button", { name: "Perioda 1, skupina 18", exact: true }).click();
  await expect(page.getByRole("region", { name: "Vyhodnocení cvičení" })).toContainText("2 z 2");
});

test("keeps the element selection and the name exercise usable on a 360 px screen", async ({
  page,
}) => {
  await keepQuestionOrder(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  const table = page.getByRole("region", { name: "Periodická tabulka" });

  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await table.getByRole("button", { name: "Skupina 18" }).click();
  await expect(page.getByRole("button", { name: "Přejít na cvičení (83 prvků)" })).toBeVisible();
  await table.getByRole("button", { name: "Skupina 18" }).click();
  await page.getByRole("button", { name: "Přejít na cvičení (90 prvků)" }).click();

  const input = page.getByRole("textbox", { name: "Značka prvku" });
  await expect(input).toBeFocused();
  await expect(input).toBeInViewport();
  await input.fill("H");
  await input.press("Enter");

  await expect(page.getByRole("heading", { name: "Zadání: Helium" })).toBeVisible();
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("opens the same name and symbol practice at /procvicovani/prvky", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/prvky");
  const input = page.getByRole("textbox", { name: "Značka prvku" });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Názvy a značky prvků");
  await page.getByRole("button", { name: "Přejít na cvičení (90 prvků)" }).click();
  await expect(page.getByRole("heading", { name: "Zadání: Vodík" })).toBeVisible();
  await input.fill("H");
  await input.press("Enter");
  await expect(page.getByText("Správně: 1")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/procvicovani/prvky");
});

test("shares the element selection between the name practice and the blind table", async ({
  page,
}) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/prvky");
  const table = page.getByRole("region", { name: "Periodická tabulka" });

  await page.getByRole("button", { name: "Zrušit výběr" }).click();
  await table.getByRole("button", { name: "Skupina 2" }).click();
  await expect(page.getByRole("button", { name: "Přejít na cvičení (6 prvků)" })).toBeVisible();
  await expect(table.getByRole("button", { name: "Skupina 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goto("/procvicovani/periodicka-tabulka");
  await expect(page.getByRole("button", { name: "Přejít na cvičení (6 prvků)" })).toBeVisible();
  await page.getByRole("button", { name: "Přejít na cvičení (6 prvků)" }).click();
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Beryllium" })).toBeVisible();
  await expect(table.getByText("?", { exact: true })).toHaveCount(118);
});

test("returns from an exercise to the practice categories and to the dashboard", async ({
  page,
}) => {
  await page.goto("/procvicovani/periodicka-tabulka");
  const mainNavigation = page.getByRole("navigation", { name: "Hlavní navigace" });
  await expect(mainNavigation.getByRole("link", { name: "Procvičovat" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page
    .getByRole("navigation", { name: "Drobečková navigace" })
    .getByRole("link", { name: "Procvičovat" })
    .click();
  await expect(page).toHaveURL(/\/procvicovani$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Procvičovat");

  await expect(page.getByRole("link", { name: "Procvičit názvosloví" })).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await page.getByRole("link", { name: "Procvičit názvosloví" }).click();
  await expect(page).toHaveURL(/\/procvicovani\/nazvoslovi$/);
  await mainNavigation.getByRole("link", { name: "Domů" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Anorganická chemie");
});
