import { expect, test } from "@playwright/test";

test("shows local periodic mastery after an answer and an offline reload", async ({
  context,
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999_999;
  });
  await page.goto("/procvicovani/periodicka-tabulka");
  await page.getByRole("button", { name: "Přejít na cvičení (90 prvků)" }).click();
  await expect(page.getByRole("heading", { name: "Hledaný prvek: Vodík" })).toBeVisible();
  await page.evaluate(() => {
    window.addEventListener(
      "inorganic:attempt-saved",
      () => document.documentElement.setAttribute("data-attempt-saved", "true"),
      { once: true },
    );
  });
  await page
    .getByRole("region", { name: "Periodická tabulka" })
    .getByRole("button", { name: "Perioda 1, skupina 1", exact: true })
    .click();
  await expect(page.getByText("Správně: 1")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-attempt-saved", "true");

  await page.goto("/pokrok");
  await expect(page.getByRole("heading", { name: "Zvládnutí periodické tabulky" })).toBeVisible();
  const hydrogen = page.getByRole("img", { name: /^Vodík \(H\): (?!Bez dat)/ });
  await expect(hydrogen).toBeVisible();
  await expect(hydrogen).toHaveAttribute("aria-label", /počet pokusů: [1-9]/);
  await expect(page.getByRole("list", { name: "Legenda zvládnutí" })).toContainText("Bez dat");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(hydrogen).toBeVisible();
  await expect(hydrogen).toHaveAttribute("aria-label", /počet pokusů: [1-9]/);
});
