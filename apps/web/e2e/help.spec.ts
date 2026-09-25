import { expect, test } from "@playwright/test";

test("help and privacy pages are linked and available from the installed offline shell", async ({
  page,
  context,
}) => {
  await page.goto("/icon.svg");
  await page.evaluate(async () => {
    const previous = await caches.open("inorganic-shell-v5");
    await previous.put("/obsolete-shell-entry", new Response("old"));
    const unrelated = await caches.open("learner-data-cache");
    await unrelated.put("/unrelated-entry", new Response("keep"));
  });
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => caches.keys()))
    .toEqual(expect.arrayContaining(["inorganic-shell-v6", "learner-data-cache"]));
  expect(await page.evaluate(() => caches.keys())).not.toContain("inorganic-shell-v5");
  await page.getByRole("link", { name: "Nápověda" }).click();
  await expect(page.getByRole("heading", { name: "Nápověda" })).toBeVisible();
  await expect(page.getByText(/Příprava a výroba látek vychází/)).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("link", { name: "Ochrana soukromí a práce s údaji" }).click();
  await expect(page).toHaveURL(/\/soukromi$/);
  await expect(page.getByRole("heading", { name: "Ochrana soukromí" })).toBeVisible();
  await expect(page.getByText(/Provozovatel musí před/)).toBeVisible();
});
