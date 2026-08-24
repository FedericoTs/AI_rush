import { expect, test } from "@playwright/test";
import { CATALOG } from "../src/levels/catalog";

/**
 * The level index and the practice room.
 *
 * A run deals fourteen levels in an order nobody chooses, which is right for a
 * run and useless for anyone who wants another go at the one that beat them.
 * These check the other door: every level listed, every level reachable, and
 * nothing that happens in there ever reaching the leaderboard.
 */

test("the index lists every level in the catalogue", async ({ page }) => {
  await page.goto("/levels");
  await expect(page.getByRole("heading", { name: /AI RUSH/ })).toBeVisible();

  for (const level of CATALOG) {
    await expect(page.locator(`[data-level-id="${level.id}"]`)).toBeVisible();
  }
  await expect(page.locator("[data-level-id]")).toHaveCount(CATALOG.length);
});

test("each row says what the interface pretends to be, and not what it does", async ({ page }) => {
  await page.goto("/levels");
  for (const level of CATALOG) {
    const row = page.locator(`[data-level-id="${level.id}"]`);
    await expect(row).toContainText(level.title);
    await expect(row).toContainText(level.parodies);
    await expect(row).toContainText(`par ${level.parSeconds}s`);
  }
});

/*
 * The whole point of the feature. Every shipped level must be individually
 * reachable — if one of these ever fails, a level exists that nobody can get
 * to except by luck of the deal.
 */
for (const level of CATALOG) {
  test(`${level.id} can be played on its own`, async ({ page }) => {
    await page.goto(`/levels/${level.id}`);

    /* The proxy puts a seed in the URL exactly as it does for a real run —
       without one, every attempt at a level would be the same attempt. */
    await expect(page).toHaveURL(/seed=/);
    await expect(page.getByTestId("practice-tag")).toContainText("PRACTICE 1/1");
    await expect(page.locator(`[data-level="${level.id}"]`)).toBeVisible();
  });
}

test("clicking a row from the index starts that level", async ({ page }) => {
  await page.goto("/levels");
  await page.locator('[data-level-id="L37"]').click();
  await expect(page.getByTestId("practice-tag")).toBeVisible();
  await expect(page.locator('[data-level="L37"]')).toBeVisible();
});

test("play-all deals the whole catalogue in order", async ({ page }) => {
  await page.goto("/levels/all");
  await expect(page.getByTestId("practice-tag")).toContainText(`PRACTICE 1/${CATALOG.length}`);
  await expect(page.locator(`[data-level="${CATALOG[0]!.id}"]`)).toBeVisible();

  await page.getByRole("button", { name: "SKIP THIS LEVEL" }).click();
  await expect(page.getByTestId("practice-tag")).toContainText(`PRACTICE 2/${CATALOG.length}`);
  await expect(page.locator(`[data-level="${CATALOG[1]!.id}"]`)).toBeVisible();
});

test("a hand-written pair plays both, in the order given", async ({ page }) => {
  await page.goto("/levels/L37,L01");
  await expect(page.locator('[data-level="L37"]')).toBeVisible();
  await page.getByRole("button", { name: "SKIP THIS LEVEL" }).click();
  await expect(page.locator('[data-level="L01"]')).toBeVisible();
});

test("a level that does not exist is a 404, not a broken run", async ({ page }) => {
  const res = await page.goto("/levels/L99");
  expect(res?.status()).toBe(404);
});

/*
 * Practice counts up. The countdown is the entire pressure of a real run, and
 * pressure is what a training room exists to remove.
 */
test("the clock counts up and the run is not filed", async ({ page }) => {
  const posted: string[] = [];
  await page.route("**/api/run/**", (route) => {
    posted.push(route.request().url());
    return route.abort();
  });

  await page.goto("/levels/L01");
  const clock = page.getByTestId("clock");

  /* A five-minute countdown would read 4:5x here; this reads 0:0x. */
  await expect(clock).toHaveText(/^0:0\d$/);
  const first = Number((await clock.textContent())!.split(":")[1]);
  await expect(clock).toHaveText(new RegExp(`^0:0[${Math.min(first + 2, 9)}-9]$`), {
    timeout: 5_000,
  });

  expect(posted).toHaveLength(0);
});

test("practice shows no score and no combo — there is nothing to win in here", async ({ page }) => {
  await page.goto("/levels/L01");
  await expect(page.getByText("SCORE")).toHaveCount(0);
});

test("skipping in practice costs nothing", async ({ page }) => {
  await page.goto("/levels/all");
  await expect(page.getByText("free in here")).toBeVisible();
  await expect(page.getByText("−10s")).toHaveCount(0);
});

test("the end of a practice run offers a way back in and no way onto the board", async ({ page }) => {
  await page.goto("/levels/L01");
  await page.getByRole("button", { name: "SKIP THIS LEVEL" }).click();

  await expect(page.getByTestId("final-score")).toHaveText("0/1");
  await expect(page.getByText("PRACTICE", { exact: true })).toBeVisible();

  /* No claim box, no rank, no share — none of it applies to a run nobody filed. */
  await expect(page.getByRole("button", { name: /Claim your place/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Post to X" })).toHaveCount(0);

  await expect(page.getByRole("link", { name: "Run it again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pick another level" })).toBeVisible();
  await page.getByRole("link", { name: /five minutes, for real/ }).click();
  await expect(page).toHaveURL(/\/play\?seed=/);
});

test("a solved practice level is reported against par, not in points", async ({ page }) => {
  await page.goto("/levels/L01");
  /* L01 is the red-Continue dialog: the honest solve is one click. */
  await page.getByRole("button", { name: /Continue/ }).click();

  await expect(page.getByTestId("final-score")).toHaveText("1/1");
  await expect(page.getByText(/par 10s/)).toBeVisible();
});

test("the way in is on the front page and the board", async ({ page }) => {
  await page.goto("/");
  const fromHome = page.getByRole("link", { name: /All \d+ levels/ });
  await expect(fromHome).toBeVisible();
  await fromHome.click();
  await expect(page).toHaveURL(/\/levels$/);

  await page.goto("/board");
  await expect(page.getByRole("link", { name: /practise any level/i })).toBeVisible();
});

/* A leaderboard you could farm one level at a time would not be worth being on. */
test("the index says plainly that practice does not count", async ({ page }) => {
  await page.goto("/levels");
  await expect(page.getByText(/nothing you do reaches the leaderboard/i)).toBeVisible();
});

/*
 * Two measurements that only exist in a real browser.
 *
 * jsdom does not apply CSS modules, so a computed-style assertion in the unit
 * suite would read the browser default and pass forever. These are the bits of
 * two levels where the exact rendered value *is* the mechanic.
 */
test("L24's free tier really is 8px of #f4f4f5 on white", async ({ page }) => {
  await page.goto("/levels/L24");
  const free = page.getByRole("button", { name: "Continue with Free" });
  await expect(free).toBeVisible();

  const style = await free.evaluate((el) => {
    const s = getComputedStyle(el);
    return { size: s.fontSize, colour: s.color };
  });
  expect(style.size).toBe("8px");
  expect(style.colour).toBe("rgb(244, 244, 245)");

  /* Cruel to the eyes, never to the thumbs: it still has to be tappable. */
  const box = (await free.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(24);
});

test("L10's escape hatch is set in the same body text it hides in", async ({ page }) => {
  await page.goto("/levels/L10");
  const escape = page.getByRole("button", { name: /By continuing to not read this/ });
  const clause = page.locator("p").filter({ has: escape });

  const [link, body] = await Promise.all([
    escape.evaluate((el) => getComputedStyle(el).color),
    clause.evaluate((el) => getComputedStyle(el).color),
  ]);
  expect(link).toBe(body);
});
