import AxeBuilder from "@axe-core/playwright";
import { mathTopic01, mathTopics } from "@inorganic/content/higher-mathematics";
import { expect, test } from "@playwright/test";

test("higher mathematics supports a wrong answer, correction, hints and solution", async ({
  page,
}) => {
  const topic = mathTopic01;
  const exercise = topic.exercises[0];
  if (!exercise) throw new Error("The first mathematics topic has no exercises.");

  await page.goto(`/predmety/matematika/procvicovani/${topic.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: `${topic.number}. ${topic.title}` }),
  ).toBeVisible();
  await expect(page.locator("#math-exercise-prompt .katex").first()).toBeVisible();

  await page.getByRole("button", { name: "Zobrazit nápovědu" }).click();
  await expect(page.getByText(exercise.hints[0] ?? "")).toBeVisible();
  await page.getByRole("textbox", { name: "Vaše odpověď" }).fill("nesprávná odpověď");
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("status")).toContainText("Odpověď zatím nesouhlasí");

  await page.getByRole("textbox", { name: "Vaše odpověď" }).fill(exercise.answer);
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByRole("status")).toContainText("Správně.");
  await page.getByRole("button", { name: "Zobrazit řešení" }).click();
  await expect(page.getByRole("heading", { name: "Řešení krok za krokem" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Další úloha" })).toBeVisible();
});

test("higher mathematics catalog and exercise meet WCAG 2.2 AA checks", async ({ page }) => {
  await page.goto("/predmety/matematika/procvicovani");
  await expect(
    page.getByRole("heading", { level: 1, name: "Matematika: Procvičovat" }),
  ).toBeVisible();
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.goto(`/predmety/matematika/procvicovani/${mathTopic01.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: `${mathTopic01.number}. ${mathTopic01.title}` }),
  ).toBeVisible();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test("old chemistry-area mathematics URLs redirect into the mathematics subject", async ({
  page,
}) => {
  await page.goto(`/procvicovani/matematika/${mathTopic01.id}`);
  await expect(page).toHaveURL(`/predmety/matematika/procvicovani/${mathTopic01.id}`);
  await expect(
    page
      .getByRole("navigation", { name: "Předmět" })
      .locator("visible=true")
      .getByRole("link", { name: "Matematika" }),
  ).toHaveAttribute("aria-current", "true");
  await page.goto("/procvicovani");
  await expect(page.getByRole("link", { name: /Vyšší matematika/ })).toHaveCount(0);
});

test("every section shows theory, passes WCAG checks and never widens the page", async ({
  page,
}) => {
  test.setTimeout(240_000);
  // 64 linked exercises would exceed the per-account solve limit (60 / 10 min);
  // the sweep covers the authored steps and the fallback note instead.
  await page.route("**/api/v1/subjects/matematika/solve", (route) => route.abort());
  for (const topic of mathTopics) {
    await page.goto(`/predmety/matematika/procvicovani/${topic.id}`);
    await page.getByText("Výklad k okruhu").click();
    await expect(page.getByRole("heading", { level: 2, name: "Výklad" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: topic.theory[0]?.heading ?? "", exact: true }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations, `${topic.id}: ${JSON.stringify(results.violations)}`).toEqual([]);

    for (const [index] of topic.exercises.entries()) {
      const hint = page.getByRole("button", { name: /nápověd/i });
      while (await hint.isEnabled()) await hint.click();
      await page.getByRole("button", { name: "Zobrazit řešení" }).click();
      await expect(page.getByText("Počítám řešení…")).toHaveCount(0, { timeout: 15_000 });
      const full = page.getByRole("button", { name: "Celé řešení" });
      while ((await full.count()) > 0) await full.first().click();
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${topic.id} exercise ${index + 1}`).toBeLessThanOrEqual(
        page.viewportSize()?.width ?? 0,
      );
      await page
        .getByRole("button", {
          name: index + 1 === topic.exercises.length ? "Dokončit okruh" : "Další úloha",
        })
        .click();
    }
    await expect(page.getByRole("heading", { name: "Okruh dokončen" })).toBeVisible();
  }
});

test("Učivo lists the nine sections and a section shows theory with its own solver types", async ({
  page,
}) => {
  await page.goto("/predmety/matematika");
  await expect(page.getByRole("heading", { level: 1, name: "Matematika: Učivo" })).toBeVisible();
  const tiles = page.getByRole("main").getByRole("link", { name: /^Okruh \d/ });
  await expect(tiles).toHaveCount(9);
  await tiles.nth(1).click();

  const topic = mathTopics[1];
  if (!topic) throw new Error("Missing section 2.");
  await expect(page).toHaveURL(`/predmety/matematika/${topic.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: `${topic.number}. ${topic.title}` }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Výklad" })).toBeVisible();
  const types = page.getByRole("navigation", { name: "Typ úlohy" }).getByRole("button");
  await expect(types).toHaveText(["Limita", "Derivace", "Implicitní derivace"]);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test("a linked exercise shows the solver's steps one by one", async ({ page }) => {
  await page.goto(`/predmety/matematika/procvicovani/${mathTopic01.id}`);
  await page.getByRole("button", { name: "Zobrazit řešení" }).click();
  const sympy = page.getByRole("region", { name: "Výpočet ověřený SymPy" });
  const steps = sympy.getByRole("list", { name: "Kroky řešení" });
  await expect(steps.locator(":scope > li")).toHaveCount(1);
  await expect(sympy.getByText("Ověřeno: sympy.limit")).toBeVisible();
  await sympy.getByRole("button", { name: /^Další krok/ }).click();
  await expect(steps.locator(":scope > li")).toHaveCount(2);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});
