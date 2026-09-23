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
  await expect(
    table.getByRole("button", { name: "Perioda 1, skupina 1: mimo výběr", exact: true }),
  ).toBeDisabled();

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
      table.getByRole("button", { name: `Vybraná pozice: Perioda ${period}, skupina 18` }),
    ).toHaveText("●");
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

  await page.reload();

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
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
