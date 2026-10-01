import { expect, test } from "@playwright/test";

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
