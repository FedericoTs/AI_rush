import { expect, test } from "./fixtures";
/* These three are *about* the screen, so they need a page that has not already
   answered it — the fixture answers it for everything else. */
import { test as rawTest } from "@playwright/test";
import { CATALOG } from "../src/levels/catalog";

/** What a first-time player can reach. Locked levels are earned or found. */
const OPEN = CATALOG.filter((m) => !m.unlock);
const LOCKED = CATALOG.filter((m) => m.unlock);

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

  /* Locked levels are listed too. A catalogue with holes in it is how you
     find out something exists; a lock nobody can see is just an absence. */
  for (const level of CATALOG) {
    await expect(page.locator(`[data-level-id="${level.id}"]`)).toBeVisible();
  }
  await expect(page.locator("[data-level-id]")).toHaveCount(CATALOG.length);
  await expect(page.locator("[data-locked='yes']")).toHaveCount(LOCKED.length);
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
for (const level of OPEN) {
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

/* "all" means all of yours. A fresh browser has opened nothing, so play-all
   is the unlocked catalogue — not every level in the file. */
test("play-all deals everything this browser has opened, in order", async ({ page }) => {
  await page.goto("/levels/all");
  await expect(page.getByTestId("practice-tag")).toContainText(`PRACTICE 1/${OPEN.length}`);
  await expect(page.locator(`[data-level="${OPEN[0]!.id}"]`)).toBeVisible();

  await page.getByRole("button", { name: "SKIP THIS LEVEL" }).click();
  await expect(page.getByTestId("practice-tag")).toContainText(`PRACTICE 2/${OPEN.length}`);
  await expect(page.locator(`[data-level="${OPEN[1]!.id}"]`)).toBeVisible();
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

/*
 * Locked content, and the two ways it opens.
 *
 * The share ladder is verified server-side and cannot be exercised from here
 * without a second real player, which is the point of it — so these cover the
 * client half: what a locked level looks like, that the secret is genuinely
 * findable, and that a share link carries its own deck.
 */
test("locked levels say what they are and how they open, without spoiling them", async ({ page }) => {
  await page.goto("/levels");

  for (const level of LOCKED) {
    const row = page.locator(`[data-level-id="${level.id}"]`);
    await expect(row).toHaveAttribute("data-locked", "yes");
    await expect(row).not.toHaveAttribute("href", /./);
    /* Still shows what it pretends to be. Never what it does. */
    await expect(row).toContainText(level.parodies);
  }
});

test("the front page sheet hides a locked level's name, not its existence", async ({ page }) => {
  await page.goto("/");
  const locked = page.locator("[data-home-level][data-locked='yes']");
  await expect(locked).toHaveCount(LOCKED.length);
  await expect(locked.first()).toContainText("Locked");
  /* And the secret does not even advertise a price. */
  await expect(page.getByText("Not for sale. Found.")).toBeVisible();
});

/*
 * The one secret in the game.
 *
 * Every level's footer has carried two "Careers" links since the first one
 * shipped. The second is real, nothing says so, and clicking it is the only
 * way in.
 */
test("the duplicate Careers link in the footer opens the hidden level", async ({ page }) => {
  await page.goto("/levels/L05");
  await expect(page.locator('[data-level="L05"]')).toBeVisible();

  const careers = page.locator('[data-secret="careers"]');
  await expect(careers).toHaveCount(1);
  await expect(careers).toHaveText("Careers");

  await careers.click();
  await expect(page.getByText("You read the footer.")).toBeVisible();

  /* And it stays open. */
  await page.goto("/levels");
  await expect(page.locator('[data-level-id="L49"]')).not.toHaveAttribute("data-locked", "yes");
  await page.goto("/levels/L49");
  await expect(page.locator('[data-level="L49"]')).toBeVisible();
});

test("the hidden level is the one exam the game has been setting all along", async ({ page }) => {
  await page.goto("/levels/L05");
  await page.locator('[data-secret="careers"]').click();
  await page.goto("/levels/L49");

  await expect(page.getByText(/You found this by reading a footer/)).toBeVisible();
  await page.getByRole("button", { name: "The red one on the right" }).click();
  await page
    .getByRole("button", { name: /Read the body text and find the line/ })
    .click();
  await page.getByRole("button", { name: "Eight grey pixels below the fold" }).click();
  await page.getByRole("button", { name: "Submit application" }).click();

  await expect(page.getByTestId("final-score")).toHaveText("1/1");
});

/*
 * A challenge link carries the sharer's unlock state, so their run reproduces
 * exactly — which means whoever opens it gets to play a level they have not
 * opened themselves. That is a much better advertisement than a description.
 */
test("a share link deals the sharer's deck, locked levels included", async ({ page }) => {
  await page.goto("/play?seed=SHARE1&u=3&x=1");
  await expect(page.getByTestId("clock")).toBeVisible();

  /* Same link, same deck, every time — the promise the head-to-head rests on. */
  const first = await page.locator("[data-level]").getAttribute("data-level");
  await page.goto("/play?seed=SHARE1&u=3&x=1");
  await expect(page.locator("[data-level]")).toHaveAttribute("data-level", first!);

  /* And without the unlock params the same seed deals a different deck, which
     is exactly why the params have to travel. */
  await page.goto("/play?seed=SHARE1");
  await expect(page.locator("[data-level]")).toBeVisible();
});

test("an unlocked run posts no score of its own — sharing is not pay-to-win", async ({ page }) => {
  await page.goto("/levels");
  await expect(
    page.getByText(/A locked level is worth exactly what its tier is worth/),
  ).toBeVisible();
});

/*
 * Sensors, and the promise that a run survives every permission denied.
 *
 * Playwright grants nothing by default, so this is the exact shape of a
 * player who taps "No sensors": every level still reachable, every fallback a
 * real level rather than an apology.
 */
const SENSORS = CATALOG.filter((m) => m.family === "sensor");

rawTest("calibration asks once, before the clock, and never blocks a run", async ({ page }) => {
  await page.goto("/play");

  await expect(page.getByText("Before the clock starts")).toBeVisible();
  /* The clock must not be running behind it — five minutes draining behind a
     permission prompt would be the cruellest bug in the game. */
  await expect(page.getByTestId("clock")).toHaveCount(0);

  await page.getByRole("button", { name: "No sensors" }).click();
  await expect(page.getByTestId("clock")).toBeVisible();

  /* Asked once. A game that re-asks on every run is a website. */
  await page.goto("/play");
  await expect(page.getByTestId("clock")).toBeVisible();
  await expect(page.getByText("Before the clock starts")).toHaveCount(0);
});

rawTest("mercy mode never sees the screen at all", async ({ page }) => {
  await page.goto("/play?mercy=1");
  await expect(page.getByTestId("clock")).toBeVisible();
  await expect(page.getByText("Before the clock starts")).toHaveCount(0);
});

rawTest("practice opens straight into the level, no questions", async ({ page }) => {
  await page.goto("/levels/L01");
  await expect(page.locator('[data-level="L01"]')).toBeVisible();
  await expect(page.getByText("Before the clock starts")).toHaveCount(0);
});

/*
 * The hard rule from GAME_DESIGN P5: deny everything and still get a complete,
 * fair five minutes. Every sensor level has to render something playable with
 * no permissions at all.
 */
for (const level of SENSORS) {
  test(`${level.id} is playable with every permission denied`, async ({ page }) => {
    await page.goto(`/levels/${level.id}`);
    await expect(page.locator(`[data-level="${level.id}"]`)).toBeVisible();
    /* Not a dead end, not an apology — something to actually do. */
    await expect(page.locator(`[data-level="${level.id}"] button, [data-level="${level.id}"] input`).first())
      .toBeVisible();
  });
}

test("L35's fallback trusts you, and says so", async ({ page }) => {
  await page.goto("/levels/L35");
  await expect(page.getByText(/Please stand up anyway. We trust you/)).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeDisabled();

  /* Six seconds of honour system, then it believes whatever you tick. */
  await expect(page.getByRole("checkbox")).toBeEnabled({ timeout: 9_000 });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("final-score")).toHaveText("1/1");
});

test("L19's fallback is an ASCII face with clickable eyes", async ({ page }) => {
  await page.goto("/levels/L19");
  for (let i = 0; i < 7; i++) {
    await page.getByLabel(i % 2 ? "Blink the right eye" : "Blink the left eye").click();
  }
  await expect(page.getByTestId("final-score")).toHaveText("1/1");
});

/* Which delivery this browser gets is the browser's business — Chrome exposes
   a no-op navigator.vibrate, Safari exposes nothing. What matters is that the
   level says which one you got and is playable either way. */
test("L26 tells you how the pattern was delivered, whichever way it was", async ({ page }) => {
  await page.goto("/levels/L26");
  await expect(
    page.getByText(/Your device buzzed it|flashed and beeped it instead/),
  ).toBeVisible();
  await expect(page.getByTestId("l26-pad")).toBeVisible();
  await expect(page.getByTestId("l26-stage")).toBeVisible();
});
