import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * The run loop, in a real browser.
 *
 * Levels are identified by their data-level attribute rather than by position,
 * so this survives the deck being re-tuned. Anything it doesn't know how to
 * solve, it skips — which exercises the skip path too.
 */

const SEED = "ABC123";

/**
 * The id of whatever level is on screen, or null once the run is over.
 *
 * It has to wait rather than sample: a level mounts a beat after the
 * navigation or the previous skip, and an instant `count()` reads zero during
 * that beat and reports the run finished when it has not started. So this
 * races the two states that are actually possible — a level, or the tally —
 * and only calls it null when the tally wins.
 */
async function currentLevel(page: Page): Promise<string | null> {
  const el = page.locator("[data-level]").first();

  await Promise.race([
    el.waitFor({ state: "attached" }).catch(() => {}),
    page.getByTestId("final-score").waitFor({ state: "visible" }).catch(() => {}),
  ]);

  return (await el.count()) === 0 ? null : el.getAttribute("data-level");
}

/**
 * Wait for the stage to actually turn over after a solve or a skip.
 *
 * Not a fixed timeout: the next level deals instantly on a warm page and
 * slowly on a cold one, so any constant is both too long and too short. The
 * run ending is the other legitimate outcome, hence the race.
 */
async function advance(page: Page, from: string) {
  await Promise.race([
    page.locator(`[data-level="${from}"]`).waitFor({ state: "detached" }).catch(() => {}),
    page.getByTestId("final-score").waitFor({ state: "visible" }).catch(() => {}),
  ]);
}

async function solveOrSkip(page: Page, id: string) {
  switch (id) {
    case "L01":
      await page.getByRole("button", { name: "⚠ Continue" }).click();
      return "solved";

    case "L02":
      for (let i = 0; i < 6; i++) {
        await page.getByTestId(`otp-cell-${i}`).click();
        await page.keyboard.type("481516"[i]!);
      }
      await page.getByRole("button", { name: "Verify" }).click();
      return "solved";

    case "L36":
      await page.getByLabel("Email address").fill("someone@example.com");
      await page.getByLabel("Password", { exact: true }).fill("hunter22");
      await page.getByRole("button", { name: "Sign in" }).click();
      return "solved";

    case "L37": {
      const target = [4, 7, 2, 9];
      for (let d = 0; d < 4; d++) {
        const dial = page.getByRole("spinbutton", { name: `Dial ${d + 1}` });
        const up = page.getByRole("button", { name: `Dial ${d + 1} up` });
        for (let turn = 0; turn < 10; turn++) {
          if (Number(await dial.getAttribute("aria-valuenow")) === target[d]) break;
          await up.click();
        }
      }
      await page.getByRole("button", { name: "Confirm PIN" }).click();
      return "solved";
    }

    default:
      /* L11 needs reflexes and L12 needs drag physics. Both are covered by
         unit tests; here they exercise the skip path instead. */
      await page.getByRole("button", { name: "SKIP THIS LEVEL" }).click();
      return "skipped";
  }
}

test("a seeded run plays, scores, and reaches the tally", async ({ page }) => {
  await page.goto(`/play?seed=${SEED}`);
  await expect(page.getByTestId("clock")).toBeVisible();

  const seen: string[] = [];
  let solved = 0;

  for (let step = 0; step < 8; step++) {
    const id = await currentLevel(page);
    if (!id) break;
    seen.push(id);
    if ((await solveOrSkip(page, id)) === "solved") solved++;
    await advance(page, id);
  }

  expect(seen.length).toBeGreaterThan(2);
  expect(solved).toBeGreaterThan(0);
  /* No level repeats inside one run. */
  expect(new Set(seen).size).toBe(seen.length);
});

test("the clock runs down and never stops", async ({ page }) => {
  await page.goto(`/play?seed=${SEED}`);
  const clock = page.getByTestId("clock");
  const first = await clock.textContent();
  await page.waitForTimeout(2200);
  expect(await clock.textContent()).not.toBe(first);
});

test("the same seed deals the same run", async ({ page }) => {
  const order = async () => {
    await page.goto(`/play?seed=${SEED}`);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = await currentLevel(page);
      if (!id) break;
      ids.push(id);
      await page.getByRole("button", { name: "SKIP THIS LEVEL" }).click();
      await advance(page, id);
    }
    return ids;
  };
  expect(await order()).toEqual(await order());
});

test("a run with no seed gets one, in the URL, so it is shareable", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/play\?seed=[0-9A-F]+/);
});

test("the landing page puts START on the right, in red", async ({ page }) => {
  await page.goto("/");
  const start = page.getByRole("link", { name: "⚠ START" });
  await expect(start).toBeVisible();
  await expect(start).toHaveCSS("background-color", "rgb(239, 68, 68)");

  const mercy = page.getByRole("link", { name: "Mercy mode" });
  const startBox = await start.boundingBox();
  const mercyBox = await mercy.boundingBox();
  expect(startBox!.x).toBeGreaterThan(mercyBox!.x);
});

test("the ten-second way in is offered, and offered second", async ({ page }) => {
  /*
   * Five minutes is a lot to hand somebody who has just tapped a link — ten
   * of the first thirty-eight runs reached the end — so the short version is
   * offered where a visitor is already deciding whether to commit.
   *
   * Second, though. START being the wrong-coloured button on the wrong side
   * is the argument this whole page makes, and a rival call to action of
   * equal weight underneath would blunt it. So: below, and not a filled
   * button.
   */
  await page.goto("/");
  const warmup = page.getByRole("link", { name: /Not ready for five minutes/ });
  await expect(warmup).toBeVisible();

  const start = page.getByRole("link", { name: "⚠ START" });
  const startBox = (await start.boundingBox())!;
  const warmBox = (await warmup.boundingBox())!;
  expect(warmBox.y).toBeGreaterThan(startBox.y + startBox.height);
  await expect(warmup).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await warmup.click();
  await expect(page.getByRole("slider", { name: /Would a real product/ })).toBeVisible();
});
