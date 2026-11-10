import AxeBuilder from "@axe-core/playwright";
import { mathTopic01 } from "@inorganic/content/higher-mathematics";
import { expect, test } from "@playwright/test";

test("higher mathematics supports a wrong answer, correction, hints and solution", async ({
  page,
}) => {
  const topic = mathTopic01;
  const exercise = topic.exercises[0];
  if (!exercise) throw new Error("The first mathematics topic has no exercises.");

  await page.goto(`/procvicovani/matematika/${topic.id}`);
  await expect(page.getByRole("heading", { level: 1, name: topic.title })).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible();

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
  await page.goto("/procvicovani/matematika");
  await expect(page.getByRole("heading", { level: 1, name: "Vyšší matematika" })).toBeVisible();
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.goto(`/procvicovani/matematika/${mathTopic01.id}`);
  await expect(page.getByRole("heading", { level: 1, name: mathTopic01.title })).toBeVisible();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
