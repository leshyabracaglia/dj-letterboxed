import { expect, test, type Page } from "@playwright/test";

const shown = (page: Page, value: string) => page.getByText(value, { exact: true }).filter({ visible: true }).first();

// A link to something that doesn't exist (deleted, or mistyped) says so
// instead of leaving the page's loading skeleton up forever.
test("missing detail pages say they don't exist", async ({ page }) => {
  for (const [path, message] of [
    ["/dj/no-such-dj", "This DJ isn't on Beatboxd."],
    ["/event/no-such-event", "This event isn't on Beatboxd."],
    ["/venue/00000000-0000-0000-0000-000000000000", "This venue isn't on Beatboxd."],
    ["/user/no_such_user", "There's no one here by that name."],
    ["/review/00000000-0000-0000-0000-000000000000", "This review has been deleted."],
  ]) {
    await page.goto(path);
    await expect(shown(page, message)).toBeVisible();
  }
});

test("an unknown route shows the not-found page", async ({ page }) => {
  await page.goto("/no/such/page");

  await expect(shown(page, "This page doesn't exist.")).toBeVisible();
  await expect(shown(page, "Go back home")).toBeVisible();
});
