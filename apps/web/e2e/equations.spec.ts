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
function firstPublishedRoute(): Route {
  const route = publishedProducts.find((product) => product.routes.length > 0)?.routes[0];
  if (!route) throw new Error("Missing published equation route.");
  return route;
}
const firstRoute = firstPublishedRoute();
const firstManufactureCandidate = publishedProducts.flatMap((product) => {
  const route = product.routes.find(
    (candidate) =>
      candidate.kind === "manufacture" &&
      candidate.products.some((term) => term.formula === product.formula),
  );
  return route ? [{ product, route }] : [];
})[0];
if (!firstManufactureCandidate) throw new Error("Missing published equation manufacture route.");
const firstManufacture = firstManufactureCandidate;

function pattern(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u");
}

async function enterCoefficients(page: Page, route: Route): Promise<void> {
  for (const [side, label, terms] of [
    ["reactant", "reaktant", route.reactants],
    ["product", "produkt", route.products],
  ] as const) {
    for (const [index, term] of terms.entries()) {
      if (term.coefficient === 1) continue;
      const input = page.getByRole("textbox", {
        name: pattern(`Koeficient ${label} ${term.formula}`),
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

async function localEquationIds(page: Page, since: string): Promise<string[]> {
  return page.evaluate(async (sinceTimestamp) => {
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
  }, since);
}

test("beginner sees atom counts, retries, and synchronizes the saved answer", async ({ page }) => {
  const since = new Date().toISOString();
  await page.goto("/procvicovani/rovnice");
  await expect(page.getByRole("heading", { name: "Chemické rovnice" })).toBeVisible();
  await page.getByRole("button", { name: "Vyhodnotit koeficienty" }).click();
  await expect(page.getByText("To není správné řešení.")).toBeVisible();
  await expect(page.getByText(/Počty atomů ve vaší odpovědi/)).toBeVisible();
  await expect(page.getByText(/^Vlevo:/)).toBeVisible();
  await expect(page.getByText(/^Vpravo:/)).toBeVisible();
  await page.getByRole("button", { name: "Zkusit znovu" }).click();
  await enterCoefficients(page, firstRoute);
  await page.getByRole("button", { name: "Vyhodnotit koeficienty" }).click();
  await expect(page.getByText("Správně.")).toBeVisible();
  await expect.poll(async () => (await localEquationIds(page, since)).length).toBe(2);
  const ids = await localEquationIds(page, since);
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
  const products = page.getByRole("textbox", { name: /Produkty na pravé straně/ });
  await products.fill("H2O");
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
  const equation = page.getByRole("textbox", { name: "Chemická rovnice" });
  await equation.fill("H2 -> H2O");
  await page.getByRole("button", { name: "Vyhodnotit rovnici" }).click();
  await expect(page.getByText("To není správné řešení.")).toBeVisible();
  await page.getByRole("button", { name: "Zkusit znovu" }).click();
  await equation.fill(
    `${side(firstManufacture.route.reactants)} -> ${side(firstManufacture.route.products)}`,
  );
  await page.getByRole("button", { name: "Vyhodnotit rovnici" }).click();
  await expect(page.getByText("Správně.")).toBeVisible();
});
