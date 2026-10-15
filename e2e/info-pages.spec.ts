import { expect, test, type Page } from "@playwright/test";

const shown = (page: Page, value: string) => page.getByText(value, { exact: true }).filter({ visible: true }).first();

// App Store Connect links to https://beatboxd.com/privacy and /support, so
// both have to load for anyone, signed out.
test("privacy policy loads signed out", async ({ page }) => {
  await page.goto("/privacy");

  await expect(shown(page, "What we collect")).toBeVisible();
  await expect(shown(page, "leshyabracaglia@gmail.com")).toBeVisible();
});

test("support page loads signed out", async ({ page }) => {
  await page.goto("/support");

  await expect(shown(page, "Reporting and blocking")).toBeVisible();
  await expect(shown(page, "leshyabracaglia@gmail.com")).toBeVisible();
});
