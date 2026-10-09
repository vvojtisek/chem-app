import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("an administrator sees manual update guidance when in-app updates are disabled", async ({
  page,
}) => {
  const releaseUrl = "https://github.com/vvojtisek/chem-app/releases/tag/v99.0.0";
  let updateRequests = 0;
  await page.route("**/api/v1/admin/releases/latest", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        latestVersion: "99.0.0",
        releaseUrl,
        updatesEnabled: false,
      }),
    }),
  );
  await page.route("**/api/v1/admin/releases/update", (route) => {
    updateRequests += 1;
    return route.fulfill({ status: 202 });
  });

  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "E-mail nebo uživatelské jméno" })
    .fill(process.env.SEED_ADMIN_USERNAME ?? "admin");
  await page.getByLabel("Heslo").fill(process.env.SEED_ADMIN_PASSWORD ?? "CiOnlyAdmin_2026_ABCDE");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/$/);

  await expect(page.getByText("Aktualizace jen ručně")).toBeVisible();
  await expect(page.getByRole("link", { name: /Co je nového/ })).toHaveAttribute(
    "href",
    releaseUrl,
  );
  await expect(page.getByRole("button", { name: /Aktualizovat na/ })).toHaveCount(0);
  expect(updateRequests).toBe(0);

  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByText("Aktualizace jen ručně")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
