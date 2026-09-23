import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

const elementIdByName = new Map(
  (
    JSON.parse(
      readFileSync(new URL("../../../content/data/elements.json", import.meta.url), "utf8"),
    ) as readonly { readonly id: string; readonly nameCs: string }[]
  ).map(({ id, nameCs }) => [nameCs, id]),
);

async function keepQuestionOrder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.999_999;
  });
}

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

test("retries an incorrect Czech element name once", async ({ page }) => {
  await page.goto("/procvicovani/prvky");
  await page.getByRole("button", { name: "Začít cvičení" }).click();

  await page.getByLabel("Český název").fill("Helium");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("heading", { name: "Zkusíme to ještě jednou" })).toBeVisible();
  await expect(page.getByText(/H je Vodík/)).toBeVisible();
  await page.getByRole("button", { name: "Pokračovat" }).click();

  for (let question = 2; question <= 10; question += 1) {
    await page.getByLabel("Český název").fill("chybně");
    await page.getByRole("button", { name: "Vyhodnotit" }).click();
    await page.getByRole("button", { name: "Pokračovat" }).click();
  }

  await expect(page.getByText("Opakování chyby")).toBeVisible();
  await expect(page.getByText("H", { exact: true })).toBeVisible();
  await page.getByLabel("Český název").fill("Vodík");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
});

test("places a blind periodic-table element inline and moves straight on", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/procvicovani/periodicka-tabulka");
  const url = page.url();
  const table = page.getByRole("region", { name: "Periodická tabulka" });

  await expect(page.getByRole("heading", { name: "Hledaný prvek: Vodík" })).toBeVisible();
  await expect(page.getByText(/Vyberte|Kam patří|posuňte tabulku/)).toHaveCount(0);

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

  await expect(page.getByRole("heading", { name: "Hledaný prvek: Vodík" })).toBeVisible();
  await table.getByRole("button", { name: "Perioda 2, skupina 1", exact: true }).click();

  await expect(page.getByText("Špatně: 1")).toBeVisible();
  await expect(
    table.getByRole("button", { name: "Perioda 2, skupina 1: chybná odpověď" }),
  ).toHaveText("✗");
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Helium" })).toBeVisible();

  await page.clock.runFor(10_000);
  await expect(table.getByRole("button", { name: "Perioda 2, skupina 1", exact: true })).toHaveText(
    "?",
  );
  await expect(page.getByRole("timer")).toHaveText("00:10");

  await page.getByRole("button", { name: "Ukončit" }).click();
  const summary = page.getByRole("region", { name: "Vyhodnocení cvičení" });
  await expect(summary.getByText("0 z 118")).toBeVisible();
  await page.clock.runFor(5_000);
  await expect(page.getByRole("timer")).toHaveText("00:10");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Špatně: 0")).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Vodík" })).toBeVisible();
});

test("answers a highlighted periodic-table position with its Czech name", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");

  await page.getByRole("button", { name: "Začít cvičení (10 otázek)" }).click();
  await page.getByLabel("Český název nebo značka").fill("vodik");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();

  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
  await expect(page.getByText(/Perioda 1, skupina 1 je Vodík/)).toBeVisible();
});

test("completes a named-position series by keyboard with a persistent table", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  const url = page.url();
  const input = page.getByLabel("Český název nebo značka");
  const nextElement = page.getByRole("button", { name: "Další prvek" });
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  const cell = (name: string) => table.getByRole("button", { name, exact: true });

  await page.getByRole("button", { name: "Začít cvičení (10 otázek)" }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();

  await page.keyboard.type("Vodík");
  await page.keyboard.down("Enter");
  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
  await expect(nextElement).toBeFocused();
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(page.getByText("Vybraná pozice: Perioda 1, skupina 1.")).toBeVisible();
  await expect(cell("Vybraná pozice: Perioda 1, skupina 1: H, vyřešeno")).toHaveText("H");

  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await page.keyboard.type("Helium");
  await page.keyboard.press("Enter");
  await expect(nextElement).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(cell("Perioda 1, skupina 1: H, vyřešeno")).toHaveText("H");
  await expect(cell("Perioda 1, skupina 18: He, vyřešeno")).toHaveText("He");

  for (let question = 3; question <= 10; question += 1) {
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    await page.keyboard.type("chybně");
    await page.keyboard.press("Enter");
    await expect(nextElement).toBeFocused();
    await page.keyboard.press("Enter");
  }

  await expect(page.getByText("Opakování chyby")).toBeVisible();
  await expect(cell("Vybraná pozice: Perioda 2, skupina 1")).toHaveText("●");
  await expect(table.getByText("Li", { exact: true })).toHaveCount(0);

  for (let question = 1; question <= 8; question += 1) {
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    await page.keyboard.type("chybně");
    await page.keyboard.press("Enter");
    await expect(nextElement).toBeFocused();
    await page.keyboard.press("Enter");
  }

  await expect(page.getByRole("heading", { name: "Cvičení dokončeno" })).toBeVisible();
  await expect(
    page.getByText("První průchod: 2 správně, 8 chybně. Opakování: 0 správně, 8 chybně."),
  ).toBeVisible();
  await expect(cell("Perioda 1, skupina 1: H, vyřešeno")).toHaveText("H");
  await expect(cell("Perioda 1, skupina 18: He, vyřešeno")).toHaveText("He");
  await expect(cell("Perioda 2, skupina 1: chybná odpověď")).toHaveText("✗");
  expect(page.url()).toBe(url);
});

test("keeps the named-position table and its scroll position on a 360 px screen", async ({
  page,
}) => {
  await keepQuestionOrder(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  await page.getByRole("button", { name: "Začít cvičení (10 otázek)" }).click();
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  const tableScroll = () => table.evaluate((element) => element.scrollLeft);
  const pageScroll = () => page.evaluate(() => window.scrollY);

  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await table.evaluate((element) => {
    element.scrollLeft = 40;
  });

  await page.getByLabel("Český název nebo značka").fill("Vodík");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
  expect(await tableScroll()).toBe(40);
  const pageScrollBeforeNext = await pageScroll();
  expect(pageScrollBeforeNext).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Další prvek" }).click();
  const heliumCell = table.getByRole("button", {
    name: "Vybraná pozice: Perioda 1, skupina 18",
    exact: true,
  });
  await expect
    .poll(async () => {
      const [cellBox, tableBox] = await Promise.all([
        heliumCell.boundingBox(),
        table.boundingBox(),
      ]);
      return (
        cellBox !== null &&
        tableBox !== null &&
        cellBox.x >= tableBox.x &&
        cellBox.x + cellBox.width <= tableBox.x + tableBox.width
      );
    })
    .toBe(true);
  expect(await tableScroll()).toBeGreaterThan(40);
  expect(await pageScroll()).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("limits a named-position series to the selected groups", async ({ page }) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  const start = page.getByRole("button", { name: /^Začít cvičení/ });

  await expect(page.getByText("Vybráno 118 prvků. Série bude mít 10 otázek.")).toBeVisible();
  await page.getByRole("button", { name: "Zrušit výběr" }).click();
  await expect(start).toBeDisabled();
  await expect(page.getByText(/Vyberte alespoň jednu skupinu nebo spodní řadu/)).toBeVisible();

  await page.getByRole("checkbox", { name: /^1\. skupina/ }).check();
  await page.getByRole("checkbox", { name: /^17\. skupina/ }).check();
  await expect(page.getByText("Vybráno 13 prvků. Série bude mít 10 otázek.")).toBeVisible();
  await start.click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  for (let question = 1; question <= 10; question += 1) {
    await expect(page.getByText(`Otázka ${question} z 10`)).toBeVisible();
    await expect(page.getByText(/^Vybraná pozice: Perioda \d, skupina (1|17)\.$/)).toBeVisible();
    await page.getByLabel("Český název nebo značka").fill("chybně");
    await page.getByRole("button", { name: "Vyhodnotit" }).click();
    await page.getByRole("button", { name: "Další prvek" }).click();
  }

  await expect(page.getByText("Opakování chyby 1 z 10")).toBeVisible();
  await expect(page.getByText(/^Vybraná pozice: Perioda \d, skupina (1|17)\.$/)).toBeVisible();
});

test("asks group 3 as Sc, Y, Lu and Lr and accepts names and symbols in one series", async ({
  page,
}) => {
  await keepQuestionOrder(page);
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");

  await page.getByRole("button", { name: "Zrušit výběr" }).click();
  await page.getByRole("checkbox", { name: /^3\. skupina \(4\)/ }).check();
  await expect(page.getByText("Vybráno 4 prvky. Série bude mít 4 otázky.")).toBeVisible();
  await page.getByRole("button", { name: "Začít cvičení (4 otázky)" }).click();

  for (const [period, answer] of [
    [4, "Sc"],
    [5, "Yttrium"],
    [6, "lutecium"],
    [7, "Lr"],
  ] as const) {
    await expect(page.getByText(`Vybraná pozice: Perioda ${period}, skupina 3.`)).toBeVisible();
    await page.getByLabel("Český název nebo značka").fill(answer);
    await page.getByRole("button", { name: "Vyhodnotit" }).click();
    await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
    await page.getByRole("button", { name: "Další prvek" }).click();
  }

  await expect(page.getByRole("heading", { name: "Cvičení dokončeno" })).toBeVisible();
  await expect(
    page.getByText("První průchod: 4 správně, 0 chybně. Opakování: 0 správně, 0 chybně."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Změnit nastavení" }).click();
  await expect(page.getByRole("checkbox", { name: /^3\. skupina/ })).toBeChecked();
});
