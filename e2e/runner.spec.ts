import { expect, test, type Page } from "@playwright/test";

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

async function reachRunner(page: Page): Promise<boolean> {
  await page.goto("/play?seed=ABC123");
  for (let i = 0; i < 15; i++) {
    if ((await page.locator('[data-level="L11"]').count()) > 0) return true;
    const skip = page.getByRole("button", { name: "SKIP THIS LEVEL" });
    if ((await skip.count()) === 0) return false;
    await skip.click();
    await page.waitForTimeout(80);
  }
  return false;
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
  test.skip(!(await reachRunner(page)), "L11 not in this deck");

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
  test.skip(!(await reachRunner(page)), "L11 not in this deck");

  /* Five seconds spans several clock ticks and at least one visible change to
     the HUD countdown — the exact thing that used to reset the level. */
  await page.waitForTimeout(5200);
  expect(await uptime(page)).toBeGreaterThanOrEqual(4);
});

test("the canvas is actually being drawn", async ({ page }) => {
  test.skip(!(await reachRunner(page)), "L11 not in this deck");

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
  test.skip(!(await reachRunner(page)), "L11 not in this deck");

  const scrollTop = () => page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);
  const before = await scrollTop();
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  expect(await scrollTop()).toBe(before);
});
