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

test("practices a blind periodic-table position with immediate feedback", async ({ page }) => {
  await page.goto("/procvicovani/periodicka-tabulka");

  await page.getByRole("button", { name: "Začít cvičení (10 prvků)" }).click();
  await page.getByRole("button", { name: "Perioda 1, skupina 1", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
  await expect(page.getByText(/Vodík patří na pozici Perioda 1, skupina 1/)).toBeVisible();
});

test("retries an incorrect blind periodic-table position once", async ({ page }) => {
  await page.goto("/procvicovani/periodicka-tabulka");

  await page.getByRole("button", { name: "Začít cvičení (10 prvků)" }).click();
  await page.getByRole("button", { name: "Perioda 2, skupina 1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zkusíme to ještě jednou" })).toBeVisible();

  await page.getByRole("button", { name: "Pokračovat" }).click();
  for (const position of [
    "Perioda 1, skupina 18",
    "Perioda 2, skupina 1",
    "Perioda 2, skupina 2",
    "Perioda 2, skupina 13",
    "Perioda 2, skupina 14",
    "Perioda 2, skupina 15",
    "Perioda 2, skupina 16",
    "Perioda 2, skupina 17",
    "Perioda 2, skupina 18",
  ]) {
    await page.getByRole("button", { name: position, exact: true }).click();
    await page.getByRole("button", { name: "Pokračovat" }).click();
  }
  await expect(page.getByText("Opakování chyby")).toBeVisible();
  await page.getByRole("button", { name: "Perioda 1, skupina 1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
});

test("answers a highlighted periodic-table position with its Czech name", async ({ page }) => {
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");

  await page.getByRole("button", { name: "Začít cvičení (10 pozic)" }).click();
  await page.getByLabel("Český název").fill("vodik");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();

  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
  await expect(page.getByText(/Perioda 1, skupina 1 je Vodík/)).toBeVisible();
});

test("completes a named-position series by keyboard with a persistent table", async ({ page }) => {
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  const url = page.url();
  const input = page.getByLabel("Český název");
  const nextElement = page.getByRole("button", { name: "Další prvek" });
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  const cell = (name: string) => table.getByRole("button", { name, exact: true });

  await page.getByRole("button", { name: "Začít cvičení (10 pozic)" }).focus();
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
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/procvicovani/periodicka-tabulka/nazvy");
  await page.getByRole("button", { name: "Začít cvičení (10 pozic)" }).click();
  const table = page.getByRole("region", { name: "Periodická tabulka" });
  const tableScroll = () => table.evaluate((element) => element.scrollLeft);
  const pageScroll = () => page.evaluate(() => window.scrollY);

  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await table.evaluate((element) => {
    element.scrollLeft = 40;
  });

  await page.getByLabel("Český název").fill("Vodík");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("heading", { name: "Správně" })).toBeVisible();
  expect(await tableScroll()).toBe(40);
  const pageScrollBeforeNext = await pageScroll();
  expect(pageScrollBeforeNext).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Další prvek" }).click();
  await expect(
    table.getByRole("button", { name: "Vybraná pozice: Perioda 1, skupina 18", exact: true }),
  ).toBeInViewport();
  expect(await tableScroll()).toBeGreaterThan(40);
  expect(await pageScroll()).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
