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

function side(terms: Route["reactants"]): string {
  return terms
    .map((term) => `${term.coefficient === 1 ? "" : `${term.coefficient} `}${term.formula}`)
    .join(" + ");
}

/** Whether the product named `name` has a published route of `kind` with these reactants. */
function makes(name: string, kind: Route["kind"], reactants: string): boolean {
  return collection.products.some(
    (product) =>
      product.nameCs === name &&
      product.routes.some(
        (route) =>
          route.status === "owner-approved" &&
          route.kind === kind &&
          side(route.reactants) === reactants &&
          route.products.some((term) => term.formula === product.formula),
      ),
  );
}

async function currentQuestion(page: Page) {
  const card = page.getByRole("region", { name: /^Kterou látku lze takto/u });
  await expect(card).toBeVisible();
  const text = (await card.textContent()) ?? "";
  const kind: Route["kind"] = text.startsWith("Příprava") ? "preparation" : "manufacture";
  // Coefficients are joined to formulas with a no-break space on the page.
  const reactants = (/Výchozí látky: (.+?) → \?/u.exec(text)?.[1] ?? "").replace(/\s/gu, " ");
  const options = card.getByRole("button");
  const names = await options.evaluateAll((buttons) =>
    buttons.map((button) => button.firstElementChild?.textContent ?? ""),
  );
  const correctIndex = names.findIndex((name) => makes(name, kind, reactants));
  expect(
    correctIndex,
    `answer for ${kind} ${reactants} in ${JSON.stringify(names)}`,
  ).toBeGreaterThanOrEqual(0);
  return { options, correctIndex };
}

for (const correctFinal of [true, false]) {
  test(`reviews the final ${correctFinal ? "correct" : "incorrect"} production retry before results`, async ({
    page,
  }) => {
    await page.goto("/procvicovani");
    await page.getByRole("link", { name: "Kvíz: Příprava a výroba látek" }).click();
    await expect(page).toHaveURL(/\/procvicovani\/priprava-vyroba$/u);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Kvíz: Příprava a výroba látek",
    );

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
