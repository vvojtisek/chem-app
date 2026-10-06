import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { balancingReactionCollectionSchema } from "@inorganic/content/balancing-reactions-schema";
import { expect, test } from "@playwright/test";
import { z } from "zod";

test("finds an element by category, links its detail and keeps the 360 px layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/uceni/prvky");
  await expect(
    page.getByRole("heading", { level: 1, name: "Prvky a jejich skupiny" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Studijní materiály" })).toBeVisible();

  await page
    .getByRole("group", { name: "Kategorie" })
    .getByRole("button", { name: /^Halogeny \d+$/ })
    .click();
  const index = page.getByRole("region", { name: "Výsledky hledání" });
  await expect(index.getByRole("heading", { name: "Halogeny (6)" })).toBeVisible();
  await expect(index.getByRole("button")).toHaveCount(6);

  await index.getByRole("button", { name: /Chlor/ }).click();
  await expect(page).toHaveURL(/#prvek-cl$/);
  const detail = page.getByRole("region", { name: "Chlor (Cl)" });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Kategorie: Halogeny")).toBeVisible();

  await detail.getByRole("button", { name: "Zpět na přehled prvků" }).click();
  await expect(index.getByRole("button", { name: /Chlor/ })).toBeFocused();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.reload();
  await expect(page.getByRole("region", { name: "Chlor (Cl)" })).toBeVisible();
});

test("opens the balancing lesson categories and steps through an ionic explanation", async ({
  page,
}) => {
  await page.goto("/uceni/prvky/vycislovani-rovnic");
  await expect(page.getByRole("heading", { level: 1, name: "Vyčíslování rovnic" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Kategorie reakcí" }).getByRole("button"),
  ).toHaveCount(6);
  const reactionCategories = page.getByRole("navigation", { name: "Kategorie reakcí" });
  for (const label of [
    "1. Bez oxidačně-redukčních změn (12)",
    "2. Lehčí oxidačně-redukční (31)",
    "3. Těžší oxidačně-redukční (31)",
    "4. Disproporcionační a/nebo synproporcionační (18)",
    "5. Složité oxidačně-redukční (13)",
    "6. Speciality (9)",
  ]) {
    await expect(reactionCategories.getByRole("button", { name: label })).toBeVisible();
  }

  await page.getByRole("button", { name: /4\. Disproporcionační/ }).click();
  await expect(page.getByRole("heading", { name: "Vznik jodu synproporcionací" })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Náboj" })).toContainText("-1 vs 0");

  await page.getByRole("button", { name: "Další krok" }).click();
  await expect(page.getByText("Krok 2 z 14")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Krok 3 z 14")).toBeVisible();
});

test("keeps the slide layout within laptop/tablet viewports and stable across iodine steps", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/uceni/prvky/vycislovani-rovnic");
    const stage = page.getByRole("region", { name: "Výukový průvodce vyčíslováním reakcí" });
    const equation = stage.locator('[role="img"][aria-label*=" -> "]');
    const cards = stage.getByRole("list", { name: "Kontrolní bilance" });
    await expect(cards).toBeVisible();
    await expect(stage.getByRole("table")).toHaveCount(0);
    const box = await stage.boundingBox();
    const eqBox = await equation.boundingBox();
    const cardsBox = await cards.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height).toBeLessThanOrEqual(650);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
    expect(cardsBox?.y).toBeGreaterThanOrEqual((eqBox?.y ?? 0) + (eqBox?.height ?? 0));
    const itemBoxes = await cards
      .getByRole("listitem")
      .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
    expect(new Set(itemBoxes).size).toBe(1);

    await stage.getByRole("button", { name: /4. Disproporcionační/ }).click();
    const next = stage.getByRole("button", { name: /Další krok/ });
    const positions: number[] = [];
    for (let index = 0; index < 14; index++) {
      await expect(stage.getByText(`Krok ${index + 1} z 14`)).toBeVisible();
      const buttonBox = await next.boundingBox();
      positions.push(buttonBox?.y ?? 0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect((buttonBox?.y ?? 0) + (buttonBox?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      if (index === 4)
        await expect(stage.getByRole("listitem", { name: "Náboj" })).toContainText("+4 vs 0");
      if (index === 3)
        await expect(stage.locator('[data-coefficient-state="active"]')).toHaveCount(0);
      if (index === 4) {
        await expect(stage.locator('[data-coefficient="3"]')).toHaveCount(0);
        await expect(
          stage.locator('[data-coefficient="6"][data-coefficient-state="active"]'),
        ).toHaveCount(1);
      }
      if (index < 13) await next.click();
    }
    expect(
      Math.max(...positions) - Math.min(...positions),
      JSON.stringify({ viewport, positions }),
    ).toBeLessThanOrEqual(2);
    const accessibility = await new AxeBuilder({ page })
      .include('section[aria-label="Výukový průvodce vyčíslováním reakcí"]')
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(page.getByRole("list", { name: "Kontrolní bilance" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("uses periodic-table category tokens in formulas and balance cards", async ({ page }) => {
  const elements = z
    .array(z.object({ symbol: z.string(), atomicNumber: z.number().int() }))
    .parse(
      JSON.parse(
        readFileSync(new URL("../../../content/data/elements.json", import.meta.url), "utf8"),
      ),
    );
  await page.goto("/uceni/prvky/vycislovani-rovnic");
  const colors = new Map<string, string>();
  await page.getByRole("combobox").selectOption("reaction.balancing.boric-acid");
  for (const symbol of ["Na", "B", "O", "H", "Cl"]) {
    const spans = page.locator(`[data-element="${symbol}"]`);
    await expect(spans.first()).toBeVisible();
    const values = await spans.evaluateAll((nodes) =>
      nodes.map((node) => (node instanceof HTMLElement ? node.style.color : "")),
    );
    expect(new Set(values).size).toBe(1);
    const color = values[0];
    if (!color) throw new Error(`Missing color for ${symbol}`);
    const cardSymbol = page
      .getByRole("listitem", { name: symbol, exact: true })
      .locator("span")
      .first();
    expect(
      await cardSymbol.evaluate((node) => (node instanceof HTMLElement ? node.style.color : "")),
    ).toBe(color);
    colors.set(symbol, color);
  }
  await page.goto("/uceni/prvky/tabulka");
  for (const [symbol, color] of colors) {
    const element = elements.find((element) => element.symbol === symbol);
    if (!element) throw new Error(`Missing ${symbol}`);
    const tile = page.getByRole("button", {
      name: new RegExp(`^${element.atomicNumber}\\. protonové číslo;`),
    });
    expect(
      await tile.evaluate((node) =>
        node instanceof HTMLElement ? node.style.getPropertyValue("--element-category-color") : "",
      ),
    ).toBe(color);
  }
});

test("derives arsenic hydroxide and water before its complete final slide", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/uceni/prvky/vycislovani-rovnic");
  const stage = page.getByRole("region", { name: "Výukový průvodce vyčíslováním reakcí" });
  await stage.getByRole("combobox").selectOption("reaction.balancing.cat-1-06");
  const next = stage.getByRole("button", { name: /Další krok/ });
  await next.click();
  await next.click();
  await expect(stage).toContainText("x = 3 + y");
  await next.click();
  await expect(stage).toContainText("x = 2y");
  await expect(stage).toContainText("y = 3 a x = 6");
  await expect(
    stage.locator('[data-coefficient="6"][data-coefficient-state="active"]'),
  ).toHaveCount(1);
  await next.click();
  await next.click();
  await expect(stage.getByText("Krok 6 z 6")).toBeVisible();
  await expect(stage.locator('[data-coefficient-final="true"]')).toHaveCount(5);
  await expect(stage.getByText("✓ Vyčísleno", { exact: true })).toHaveCount(5);
  await expect(stage.getByRole("listitem", { name: "Náboj" })).toContainText("-6 = -6");
  const box = await stage.boundingBox();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(768);
});

test("fits the initial and final state of every seeded reaction on a laptop", async ({ page }) => {
  test.setTimeout(300_000);
  const collection = balancingReactionCollectionSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../content/data/balancing-reactions.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const curatedBalancingReactionLessons = collection.lessons.filter(
    (lesson) => lesson.status === "owner-approved" || lesson.status === "reviewed",
  );
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/uceni/prvky/vycislovani-rovnic");
  const stage = page.getByRole("region", { name: "Výukový průvodce vyčíslováním reakcí" });
  for (const category of [1, 2, 3, 4, 5, 6]) {
    await stage.getByRole("button", { name: new RegExp(`^${category}\\.`) }).click();
    for (const lesson of curatedBalancingReactionLessons.filter(
      (item) => item.category === category,
    )) {
      await stage.getByRole("combobox").selectOption(lesson.id);
      for (const index of [0, lesson.steps.length - 1]) {
        if (index > 0) {
          for (let step = 0; step < index; step++)
            await stage.getByRole("button", { name: /Další krok/ }).click();
        }
        await expect(stage.getByText(`Krok ${index + 1} z ${lesson.steps.length}`)).toBeVisible();
        if (index > 0) {
          await expect(stage.getByText("Aktuální krok: Závěrečné shrnutí")).toBeVisible();
          await expect(
            stage.locator(
              '[data-coefficient-state="unresolved"], [data-coefficient-state="active"]',
            ),
          ).toHaveCount(0);
          await expect(stage.getByText("≠ Nevyčísleno", { exact: true })).toHaveCount(0);
        }
        const box = await stage.boundingBox();
        expect(box?.height, lesson.id).toBeLessThanOrEqual(650);
        expect((box?.y ?? 0) + (box?.height ?? 0), lesson.id).toBeLessThanOrEqual(768);
        expect(await page.evaluate(() => window.scrollY), lesson.id).toBe(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          lesson.id,
        ).toBe(true);
      }
    }
  }
});

test("teaches fluorine LCM, missing boron and water last without losing resolved badges", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/uceni/prvky/vycislovani-rovnic");
  const stage = page.getByRole("region", { name: "Výukový průvodce vyčíslováním reakcí" });
  await stage.getByRole("combobox").selectOption("reaction.balancing.cat-1-02");
  const next = stage.getByRole("button", { name: /Další krok/ });
  await next.click();
  await expect(stage).toContainText("NSN(3, 4) = 12");
  await expect(stage.locator('[data-coefficient-state="active"]')).toHaveCount(2);
  await next.click();
  await expect(stage).toContainText("4 − 3 = 1");
  await expect(
    stage.locator('[data-coefficient="1"][data-coefficient-state="active"]'),
  ).toHaveCount(1);
  await next.click();
  await expect(stage).toContainText("6 / 2 = 3");
  await expect(
    stage.locator('[data-coefficient="1"][data-coefficient-state="resolved"]'),
  ).toHaveCount(1);
  await next.click();
  await expect(stage.getByText("✓ Vyčísleno", { exact: true })).toHaveCount(4);
  const box = await stage.boundingBox();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(768);
});
