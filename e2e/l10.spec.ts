import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * L10 · Scroll To Accept — the two ways it was broken.
 *
 * Of the first seven people to reach this level in production, seven skipped
 * it and none solved it. It is the level that is supposed to teach players to
 * read the slop copy, and it was teaching them to press skip.
 *
 * Neither bug is visible from a unit test: both are about layout, and jsdom
 * reports every `scrollHeight` as zero. So they are checked here, in a browser
 * that actually lays the document out.
 */

const box = (page: Page) =>
  page.locator("div").filter({ hasText: "You must read to the end" }).last();

async function open(page: Page) {
  await page.goto("/levels/L10");
  await expect(page.getByRole("heading", { name: /Updated Terms of Service/ })).toBeVisible();
}

/** Slam to the very bottom and fire exactly one scroll event, as a key would. */
async function slamToBottom(page: Page) {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find(
      (d) => d.scrollHeight > d.clientHeight + 50 && d.clientHeight < 400,
    );
    if (!el) throw new Error("no scroll box");
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll"));
  });
  /* Long enough for React to commit the longer document and re-measure. */
  await page.waitForTimeout(180);
}

const paragraphs = (page: Page) => box(page).locator("p").count();

test("the document stops growing before it can kill the browser", async ({ page }) => {
  /*
   * Twenty percent compounding is exponential in the number of times a player
   * flicks, and players flick a lot. Before the cap, fifteen seconds of honest
   * scrolling crossed eighty percent twenty-seven times and turned twenty-six
   * paragraphs into three thousand eight hundred — which is not a joke about
   * terms of service, it is a phone browser dying.
   */
  await open(page);
  expect(await paragraphs(page)).toBeLessThan(40);

  for (let i = 0; i < 20; i++) await slamToBottom(page);

  const grown = await paragraphs(page);
  expect(grown).toBeGreaterThan(60); // it must still visibly grow
  expect(grown).toBeLessThan(400); // and it must stop
});

test("the end never becomes reachable, however many times you get there", async ({ page }) => {
  /*
   * The accept button is wired to `onFail`, and its comment claimed it was
   * "reachable only if the document ever stops growing, which it does not".
   * It was reachable in about four seconds: `pct` is state measured before the
   * growth, so after a slam the bar rendered 100% over a document nowhere near
   * its end and enabled the button under it.
   *
   * A player doing the obvious thing therefore lost the level. Nobody in the
   * production data ever got that far — all seven skipped first — which is the
   * only reason this never showed up as a fail.
   */
  await open(page);
  const cta = page.locator("button").filter({ hasText: /accept/i });

  for (let i = 0; i < 20; i++) {
    await slamToBottom(page);
    await expect(cta).toBeDisabled();
    await expect(cta).toHaveText(/Scroll to the end to accept/);
  }

  /* And the bar never claims to be finished, because it is re-measured against
     the document that now exists rather than the one that did. */
  await expect(page.getByText(/^\d+%$/)).not.toHaveText("100%");
});

test("reading is still the solve", async ({ page }) => {
  /* The escape is a real link set in body-text grey at roughly two-fifths
     depth. If a change ever makes it unreachable, the level has no solution at
     all — which is the failure the production numbers looked like. */
  await open(page);
  await page.getByRole("button", { name: /you agree anyway/i }).click();
  await expect(page.getByText(/par 20s/)).toBeVisible();
});
