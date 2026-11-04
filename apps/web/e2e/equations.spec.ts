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
const publishedProducts = collection.products.map((product) => ({
  ...product,
  routes: product.routes.filter((route) => route.status === "owner-approved"),
}));
type Route = (typeof collection.products)[number]["routes"][number];
const routesById = new Map(
  publishedProducts.flatMap((product) => product.routes.map((route) => [route.id, route] as const)),
);

/** Questions come in random order, so each test reads the asked route from the page. */
async function currentRoute(page: Page): Promise<Route> {
  const card = page.locator("[data-route-id]");
  await expect(card).toBeVisible();
  const id = await card.getAttribute("data-route-id");
  const route = id ? routesById.get(id) : undefined;
  if (!route) throw new Error(`Unknown route on the page: ${id}`);
  return route;
}

function productSet(formulas: readonly string[]): string {
  return [...new Set(formulas)].sort().join("+");
}

async function enterCoefficients(page: Page, route: Route): Promise<void> {
  for (const [side, label, terms] of [
    ["reactant", "reaktant", route.reactants],
    ["product", "produkt", route.products],
  ] as const) {
    for (const [index, term] of terms.entries()) {
      if (term.coefficient === 1) continue;
      // Exact, so the coefficient of C is not confused with the one of CaO.
      const input = page.getByRole("textbox", {
        name: `Koeficient ${label} ${term.formula}`,
        exact: true,
      });
      await expect(input, `${side}-${index}`).toBeVisible();
      await input.fill(String(term.coefficient));
    }
  }
}

function side(terms: Route["reactants"]): string {
  return terms
    .map((term) => `${term.coefficient === 1 ? "" : `${term.coefficient} `}${term.formula}`)
    .join(" + ");
}

/**
 * Equation attempts for one route stored in this browser since `since`. Other tests answer
 * as the same account in parallel and their attempts are pulled in by synchronization, so
 * the route filters them out.
 */
async function localEquationIds(page: Page, since: string, questionId: string): Promise<string[]> {
  return page.evaluate(
    async ([sinceTimestamp, routeId]) => {
      const marker = JSON.parse(localStorage.getItem("inorganic.verified-account") ?? "null") as {
        userId?: string;
      } | null;
      if (!marker?.userId) return [];
      const request = indexedDB.open(`inorganic-learning.${marker.userId}`);
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const transaction = database.transaction("attempt-events", "readonly");
        const records = transaction.objectStore("attempt-events").getAll();
        return await new Promise<string[]>((resolve, reject) => {
          records.onsuccess = () =>
            resolve(
              records.result.flatMap((value: unknown) =>
                typeof value === "object" &&
                value !== null &&
                "mode" in value &&
                value.mode === "equation" &&
                "questionId" in value &&
                value.questionId === routeId &&
                "occurredAt" in value &&
                typeof value.occurredAt === "string" &&
                value.occurredAt >= sinceTimestamp &&
                "id" in value &&
                typeof value.id === "string"
                  ? [value.id]
                  : [],
              ),
            );
          records.onerror = () => reject(records.error);
        });
      } finally {
        database.close();
      }
    },
    [since, questionId] as const,
  );
}

test("beginner sees atom counts, retries, and synchronizes the saved answer", async ({ page }) => {
  const since = new Date().toISOString();
  await page.goto("/procvicovani/rovnice");
  await expect(page.getByRole("heading", { name: "Chemické rovnice" })).toBeVisible();
  await page.getByRole("button", { name: "Začátečník" }).click();
  const firstRoute = await currentRoute(page);
  // The questions are shuffled; a blank entry would be right for an equation of ones.
  const [firstReactant] = firstRoute.reactants;
  if (!firstReactant) throw new Error("Route without reactants.");
  await page
    .getByRole("textbox", { name: `Koeficient reaktant ${firstReactant.formula}`, exact: true })
    .fill(String(firstReactant.coefficient + 1));
  await page.getByRole("button", { name: "Vyhodnotit koeficienty" }).click();
  await expect(page.getByText("To není správné řešení.")).toBeVisible();
  await expect(page.getByText(/Počty atomů ve vaší odpovědi/)).toBeVisible();
  await expect(page.getByText(/^Vlevo:/)).toBeVisible();
  await expect(page.getByText(/^Vpravo:/)).toBeVisible();
  await page.getByRole("button", { name: "Zkusit znovu" }).click();
  await enterCoefficients(page, firstRoute);
  await page.getByRole("button", { name: "Vyhodnotit koeficienty" }).click();
  await expect(page.getByText("Správně.")).toBeVisible();
  await expect
    .poll(async () => (await localEquationIds(page, since, firstRoute.id)).length)
    .toBe(2);
  const ids = await localEquationIds(page, since, firstRoute.id);
  await expect
    .poll(async () =>
      page.evaluate(async (targetIds) => {
        const response = await fetch("/api/v1/me/attempt-events?limit=500", {
          credentials: "include",
        });
        if (!response.ok) return false;
        const body: unknown = await response.json();
        if (typeof body !== "object" || body === null || !("items" in body)) return false;
        const items = body.items;
        return (
          Array.isArray(items) &&
          targetIds.every((id) => items.some((item) => item?.event?.id === id))
        );
      }, ids),
    )
    .toBe(true);
});

test("advanced retries product entry and then completes coefficient balancing", async ({
  page,
}) => {
  await page.goto("/procvicovani/rovnice");
  await page.getByRole("button", { name: "Pokročilý" }).click();
  const firstRoute = await currentRoute(page);
  const products = page.getByRole("textbox", { name: /Produkty na pravé straně/ });
  await products.fill("Ne");
  await page.getByRole("button", { name: "Ověřit produkty" }).click();
  await expect(page.getByText("To není správné řešení.")).toBeVisible();
  await page.getByRole("button", { name: "Zkusit znovu" }).click();
  await products.fill(
    firstRoute.products
      .map((term) => term.formula)
      .reverse()
      .join(" + "),
  );
  await page.getByRole("button", { name: "Ověřit produkty" }).click();
  await enterCoefficients(page, firstRoute);
  await page.getByRole("button", { name: "Vyhodnotit koeficienty" }).click();
  await expect(page.getByText("Správně.")).toBeVisible();
});

test("pro retries and accepts an approved complete manufacturing equation", async ({ page }) => {
  await page.goto("/procvicovani/rovnice");
  await page.getByRole("button", { name: "Profík" }).click();
  const manufacture = await currentRoute(page);
  const equation = page.getByRole("textbox", { name: "Chemická rovnice" });
  await equation.fill("H2 -> H2O");
  await page.getByRole("button", { name: "Vyhodnotit rovnici" }).click();
  await expect(page.getByText("To není správné řešení.")).toBeVisible();
  await page.getByRole("button", { name: "Zkusit znovu" }).click();
  await equation.fill(`${side(manufacture.reactants)} -> ${side(manufacture.products)}`);
  await page.getByRole("button", { name: "Vyhodnotit rovnici" }).click();
  await expect(page.getByText("Správně.")).toBeVisible();
});

test("easy level asks for products only, as a choice of four", async ({ page }) => {
  await page.goto("/procvicovani/rovnice");
  await expect(page.getByRole("button", { name: "Snadný" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Které produkty vzniknou?" })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  const route = await currentRoute(page);
  const answer = productSet(route.products.map((term) => term.formula));
  const options = page.getByRole("group", { name: "Produkty reakce" }).getByRole("button");
  await expect(options).toHaveCount(4);
  // Formulas are read by their accessible names, without the a) to d) markers.
  const sets = await options.evaluateAll((buttons) =>
    buttons.map((button) =>
      [...button.querySelectorAll("[role=img]")].map(
        (formula) => formula.getAttribute("aria-label") ?? "",
      ),
    ),
  );
  const correctIndex = sets.findIndex((formulas) => productSet(formulas) === answer);
  expect(correctIndex, JSON.stringify({ answer, sets })).toBeGreaterThanOrEqual(0);

  await options.nth(correctIndex === 0 ? 1 : 0).click();
  await expect(page.getByText("To není správné řešení.")).toBeVisible();
  await page.getByRole("button", { name: "Zkusit znovu" }).click();

  const retried = await options.evaluateAll((buttons) =>
    buttons.map((button) =>
      [...button.querySelectorAll("[role=img]")].map(
        (formula) => formula.getAttribute("aria-label") ?? "",
      ),
    ),
  );
  await options.nth(retried.findIndex((formulas) => productSet(formulas) === answer)).click();
  await expect(page.getByText("Správně.")).toBeVisible();
  await expect(page.getByText(/^Celá rovnice:/u)).toBeVisible();
});
