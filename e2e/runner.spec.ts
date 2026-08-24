import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * L11, the flagship, on a desktop keyboard.
 *
 * Every other suite skips this level because it needs reflexes, which left its
 * game loop entirely uncovered — and that is exactly where it broke. The
 * canvas effect depended on callback props that the play route recreated on
 * every render, and the run clock re-rendered at 60fps, so the loop was torn
 * down and rebuilt sixty times a second. The runner reset constantly and no
 * jump could ever survive long enough to collect anything.
 *
 * The level publishes its own elapsed seconds on the canvas. If the loop is
 * being rebuilt that number keeps returning to zero instead of climbing, which
 * is a precise and deterministic signal — unlike trying to actually beat a
 * reflex level from a test.
 */

/*
 * Opened directly, not hunted for in a dealt deck.
 *
 * This used to skip through a hard-coded seed until L11 turned up, and
 * `test.skip` when it did not. Two things were wrong with that. A change to
 * the deal moved L11 out of that deck and all four of these quietly stopped
 * running — the suite stayed green while the only coverage of the canvas game
 * loop evaporated. And the mobile project deals a different sequence entirely,
 * because its capability set is different, so no single seed could serve both.
 *
 * The practice room renders through exactly the same `RunStage`, with the same
 * `GameClock` ticking the same second boundaries — which *is* the regression
 * under test, since the bug was the clock re-rendering the component and
 * tearing the loop down with it. Whether L11 also turns up in real decks is a
 * dealing question, and `deck.test.ts` owns it.
 */
async function reachRunner(page: Page): Promise<void> {
  await page.goto("/play?level=L11&seed=ABC123");
  await page.locator('[data-level="L11"]').waitFor({ state: "attached" });
}

/**
 * Seconds since the game loop started — not seconds of gameplay. Dying resets
 * gameplay, which is normal; only the effect re-running resets uptime.
 */
const uptime = (page: Page) =>
  page
    .locator("canvas[data-uptime]")
    .first()
    .getAttribute("data-uptime")
    .then((v) => Number(v ?? -1));

test("the game loop survives the clock ticking under it", async ({ page }) => {
  await reachRunner(page);

  await page.waitForTimeout(1500);
  const first = await uptime(page);
  await page.waitForTimeout(2000);
  const second = await uptime(page);

  expect(first).toBeGreaterThanOrEqual(1);
  /* The regression: with the effect thrashing this never got past 0. */
  expect(second).toBeGreaterThan(first);
  expect(second).toBeGreaterThanOrEqual(3);
});

test("the runner keeps its state across a clock second boundary", async ({ page }) => {
  await reachRunner(page);

  /* Five seconds spans several clock ticks and at least one visible change to
     the HUD countdown — the exact thing that used to reset the level. */
  await page.waitForTimeout(5200);
  expect(await uptime(page)).toBeGreaterThanOrEqual(4);
});

test("the canvas is actually being drawn", async ({ page }) => {
  await reachRunner(page);

  /* Compare the pixels, not their encoded length — two different frames
     encode to the same byte count often enough to make that a flake. */
  const frame = () =>
    page.evaluate(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement | null;
      return c ? c.toDataURL() : "";
    });

  const first = await frame();
  expect(first.length).toBeGreaterThan(0);

  /* Sample a few times: the scene is briefly static right after a death. */
  let changed = false;
  for (let i = 0; i < 6 && !changed; i++) {
    await page.waitForTimeout(200);
    changed = (await frame()) !== first;
  }
  expect(changed).toBe(true);
});

test("keyboard jumps reach the level rather than scrolling the page", async ({ page }) => {
  await reachRunner(page);

  const scrollTop = () => page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);
  const before = await scrollTop();
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  expect(await scrollTop()).toBe(before);
});
