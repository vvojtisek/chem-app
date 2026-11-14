import { readFileSync } from "node:fs";
import { preparationProductionCollectionSchema } from "@inorganic/content/preparation-production-schema";
import { expect, type Page, test } from "@playwright/test";

const collection = preparationProductionCollectionSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../content/data/preparation-production.json", import.meta.url),
      "utf8",
    ),
  ) as unknown,
);
type Route = (typeof collection.products)[number]["routes"][number];
const routes = new Map(
  collection.products.flatMap((product) =>
    product.routes.map((route) => [route.id, route] as const),
  ),
);

function productSet(route: Route): string {
  return [...new Set(route.products.map((term) => term.formula))].sort().join("+");
}

async function currentQuestion(page: Page) {
  const card = page.getByRole("region", { name: "Které produkty touto reakcí vzniknou?" });
  await expect(card).toBeVisible();
  const route = routes.get((await card.getAttribute("data-question-id")) ?? "");
  if (!route) throw new Error("Unknown route on the question card");
  const options = card.getByRole("list", { name: "Možnosti odpovědi" }).getByRole("button");
  const ids = await options.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("data-option-id") ?? ""),
  );
  const correctIndex = ids.indexOf(productSet(route));
  expect(
    correctIndex,
    `answer ${productSet(route)} in ${JSON.stringify(ids)}`,
  ).toBeGreaterThanOrEqual(0);
  return { options, correctIndex };
}

for (const correctFinal of [true, false]) {
  test(`reviews the final ${correctFinal ? "correct" : "incorrect"} production retry before results`, async ({
    page,
  }) => {
    await page.goto("/procvicovani");
    await page.getByRole("link", { name: "Příprava a výroba", exact: true }).click();
    await expect(page).toHaveURL(/\/procvicovani\/priprava-vyroba$/u);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Příprava a výroba");
    await expect(page.getByRole("radio", { name: "Lehká" })).toBeChecked();
    await page.getByRole("button", { name: "Spustit kvíz (10 otázek)" }).click();
    const first = await currentQuestion(page);
    await first.options.nth(first.correctIndex === 0 ? 1 : 0).click();
    await expect(page.getByText(/^Vaše odpověď:/u)).toBeVisible();
    await expect(page.getByText("Špatně: 1", { exact: true })).toBeVisible();

    for (let correct = 1; correct <= 9; correct += 1) {
      const question = await currentQuestion(page);
      await question.options.nth(question.correctIndex).click();
      // The next question replaces the card only after the dashboard has counted this answer.
      await expect(page.getByText(`Správně: ${correct}`, { exact: true })).toBeVisible();
    }

    const last = await currentQuestion(page);
    await last.options
      .nth(correctFinal ? last.correctIndex : last.correctIndex === 0 ? 1 : 0)
      .click();
    const review = page.getByRole("region", { name: "Poslední odpověď" });
    await expect(
      review.getByText(correctFinal ? "Správně" : "Špatně", { exact: true }),
    ).toBeVisible();

    await expect(page.getByRole("region", { name: "Poslední odpověď" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vyhodnocení cvičení" })).toHaveCount(0);
    await page.getByRole("button", { name: "Zobrazit výsledky" }).click();
    await expect(page.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "K zopakování" })).toBeVisible();
  });
}

test("Pokročilá accepts typed products and fills in the coefficients", async ({ page }) => {
  await page.goto("/procvicovani/priprava-vyroba");
  // The radio input is visually hidden; its label takes the click.
  await page.getByText("Pokročilá", { exact: true }).click();
  await page.getByRole("button", { name: "Spustit kvíz (10 otázek)" }).click();

  const card = page.locator("section[data-question-id]");
  const route = routes.get((await card.getAttribute("data-question-id")) ?? "");
  if (!route) throw new Error("Unknown route on the question card");
  const formulas = [...new Set(route.products.map((term) => term.formula))].reverse();
  const slots = card.getByRole("textbox", { name: /^Produkt \d+$/u });
  await expect(slots).toHaveCount(formulas.length);
  for (const [index, formula] of formulas.entries()) {
    await slots.nth(index).fill(formula);
  }
  await slots.first().press("Enter");
  await expect(card.getByText("Správně", { exact: true })).toBeVisible();
  await expect(card.getByText(/^Celá rovnice:/u)).toBeVisible();
});
