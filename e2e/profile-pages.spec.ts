import { expect, test, type Locator, type Page } from "@playwright/test";

// Fixture data from server/cmd/seed/main.go — Dixon has three reviews: alice's
// and bob's from their nights at Innervisions New York (Knockdown Center),
// and bob's from Dixon All Night Long at Nowadays. bob also logged the
// Innervisions day party - same event, same day, during the day.
const DIXON_REVIEWS = {
  aliceKnockdown: "Absolutely electric set, the buildup into the last hour in the Main Hall was insane.",
  bobKnockdown: "Dixon closing the Main Hall was pure tension and release, if a bit long.",
  bobNowadays: "Seven hours of Dixon at Nowadays, never once lost the room.",
};

// The web stack keeps earlier screens mounted (just hidden), so text from a
// previous page can still match; only look at what's on screen.
const shown = (locator: Locator) => locator.filter({ visible: true }).first();
const text = (page: Page, value: string) => shown(page.getByText(value, { exact: true }));
const link = (page: Page, name: string) => shown(page.getByRole("link", { name, exact: true }));
// A "Recent logs" row on a DJ page: a link naming the night and who logged it.
const logRow = (page: Page, night: string, username: string) =>
  shown(page.getByRole("link").filter({ hasText: night }).filter({ hasText: `@${username}` }));

test("DJ page lists every log of that DJ", async ({ page }) => {
  await page.goto("/dj/dixon");

  await expect(text(page, "Dixon")).toBeVisible();
  await expect(text(page, "Avg of 3")).toBeVisible();
  await expect(logRow(page, "Innervisions New York", "alice")).toBeVisible();
  await expect(logRow(page, "Innervisions New York", "bob")).toBeVisible();
  await expect(logRow(page, "Dixon All Night Long", "bob")).toBeVisible();
  await expect(shown(page.getByText("No logs yet for this DJ."))).toHaveCount(0);
});

test("a review shows on its DJ, event and venue pages", async ({ page }) => {
  await page.goto("/dj/dixon");

  // DJ page -> the review
  await logRow(page, "Dixon All Night Long", "bob").click();
  await expect(page).toHaveURL(/\/review\//);
  await expect(text(page, DIXON_REVIEWS.bobNowadays)).toBeVisible();

  // review -> its event, which lists the review
  await link(page, "Dixon All Night Long").click();
  await expect(page).toHaveURL(/\/event\/dixon-all-night-long$/);
  await expect(text(page, DIXON_REVIEWS.bobNowadays)).toBeVisible();
  const eventUrl = page.url();

  // event -> a venue it's been at, which lists the event
  await shown(page.getByRole("link", { name: /^Nowadays · / })).click();
  await expect(page).toHaveURL(/\/venue\//);
  await expect(text(page, "Dixon All Night Long")).toBeVisible();

  // venue -> back to the event
  await text(page, "Dixon All Night Long").click();
  await expect(page).toHaveURL(eventUrl);
  await expect(text(page, DIXON_REVIEWS.bobNowadays)).toBeVisible();

  // the DJs people saw there -> DJ page, with the review on it
  await text(page, "Dixon").click();
  await expect(page).toHaveURL(/\/dj\/dixon$/);
  await expect(text(page, DIXON_REVIEWS.bobNowadays)).toBeVisible();
});

test("an event page collects every night of it, and its venue lists it", async ({ page }) => {
  await page.goto("/dj/dixon");

  await logRow(page, "Innervisions New York", "bob").click();
  await expect(page).toHaveURL(/\/review\//);
  await expect(text(page, DIXON_REVIEWS.bobKnockdown)).toBeVisible();

  await link(page, "Innervisions New York").click();
  await expect(page).toHaveURL(/\/event\/innervisions-new-york$/);
  // Both Dixon reviews and alice's whole-night review from the night, plus
  // bob's from the day party - all one event.
  await expect(text(page, DIXON_REVIEWS.aliceKnockdown)).toBeVisible();
  await expect(text(page, DIXON_REVIEWS.bobKnockdown)).toBeVisible();
  await expect(
    text(page, "Day into night at Knockdown is the best format in the city. Sound in the Main Hall was dialed."),
  ).toBeVisible();
  await expect(
    text(page, "The Ruins in the sun with this lineup back to back. Lines were long but worth it."),
  ).toBeVisible();
  await expect(text(page, DIXON_REVIEWS.bobNowadays)).toHaveCount(0);

  // The venue lists the event once, with all three nights logged there (its
  // whole-night review cards below are titled after the event too, so look
  // at the events row itself).
  await shown(page.getByRole("link", { name: /^Knockdown Center · / })).click();
  await expect(page).toHaveURL(/\/venue\//);
  const eventRows = page.getByRole("link").filter({ hasText: "nights logged here" }).filter({ visible: true });
  await expect(eventRows).toHaveCount(1);
  await expect(eventRows).toContainText("Innervisions New York");
  await expect(eventRows).toContainText("3 nights logged here");
});
