import { expect, test, type Page } from "@playwright/test";

/**
 * Challenges, avatars, and the live counters.
 *
 * A challenge is just a seed with someone's name and number attached — no
 * lobby, nobody has to be online, and the link keeps working forever. These
 * check that the rival actually shows up during the run and that the outcome
 * is reported honestly at the end.
 */

const RIVAL = "@a_rival";
const TARGET = 4000;

async function skipToEnd(page: Page) {
  for (let i = 0; i < 20; i++) {
    const skip = page.getByRole("button", { name: "SKIP THIS LEVEL" });
    if ((await skip.count()) === 0) break;
    await skip.click();
    await page.waitForTimeout(70);
  }
  await expect(page.getByTestId("final-score")).toBeVisible();
}

test("a challenge link shows who you are chasing", async ({ page }) => {
  await page.goto(`/play?seed=CHAL01&vs=${RIVAL.slice(1)}&target=${TARGET}`);
  await expect(page.getByText("Chasing")).toBeVisible();
  await expect(page.getByText(RIVAL)).toBeVisible();
  await expect(page.getByText(`${TARGET.toLocaleString()} to go`)).toBeVisible();
});

test("an ordinary run shows no rival", async ({ page }) => {
  await page.goto("/play?seed=CHAL01");
  await expect(page.getByText("Chasing")).toHaveCount(0);
});

test("losing a challenge says so plainly", async ({ page }) => {
  await page.goto(`/play?seed=CHAL01&vs=${RIVAL.slice(1)}&target=${TARGET}`);
  await skipToEnd(page);
  /* Skipping everything scores zero, so the rival always wins this one. */
  await expect(page.getByText(/still lead by/i)).toBeVisible();
  await expect(page.getByText(/No excuses available/i)).toBeVisible();
});

test("a malformed challenge is ignored rather than shown broken", async ({ page }) => {
  await page.goto("/play?seed=CHAL01&vs=not%20a%20handle!!&target=abc");
  await expect(page.getByText("Chasing")).toHaveCount(0);
});

test("the share text names the rival when there is one", async ({ page }) => {
  await page.goto(`/play?seed=CHAL01&vs=${RIVAL.slice(1)}&target=${TARGET}`);
  await skipToEnd(page);

  const claim = page.getByRole("button", { name: /Claim your place|See the board/ });
  await claim.click();
  if ((await page.getByLabel("Your X handle").count()) > 0) {
    await page.getByLabel("Your X handle").fill(`@e2e_${Math.random().toString(36).slice(2, 8)}`);
    await page.getByRole("button", { name: "Post it" }).click();
  }

  const post = page.getByRole("link", { name: "Post to X" });
  await expect(post).toBeVisible({ timeout: 15_000 });
  const href = decodeURIComponent((await post.getAttribute("href")) ?? "");
  expect(href).toContain(RIVAL);
});

test("the front page shows live counters", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("playing now")).toBeVisible();
  await expect(page.getByText("runs today")).toBeVisible();
  await expect(page.getByText("on the board")).toBeVisible();
});

/*
 * The board is on the front page whether or not anyone is on it. Hiding it
 * while empty is backwards: an empty leaderboard with your name obviously
 * missing from the top is a better invitation than no leaderboard at all.
 */
test("the front page always shows the board, empty or not", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Survivors")).toBeVisible();
  await expect(page.getByRole("link", { name: /full board/ })).toBeVisible();

  const realRows = await page.locator("a[href*='/play?seed=']").count();
  if (realRows > 0) {
    await expect(page.getByText(/Tap anyone to play their exact run/)).toBeVisible();
  } else {
    /* Placeholder ranks, so the shape of the thing is visible from the start. */
    await expect(page.getByText(/That top row has your name on it/)).toBeVisible();
    await expect(page.getByText("#1", { exact: true })).toBeVisible();
    await expect(page.getByText("#3", { exact: true })).toBeVisible();
  }
});

test("the board offers a beat-it link on every row", async ({ page }) => {
  await page.goto("/board");
  /* A zero-score row offers nothing to chase and deliberately has no link, so
     a board full of skipped runs legitimately has none. */
  const rows = page.getByRole("link", { name: "beat it" });
  if ((await rows.count()) === 0) test.skip(true, "no scoring runs on the board yet");

  const href = await rows.first().getAttribute("href");
  expect(href).toContain("seed=");
  expect(href).toContain("vs=");
  expect(href).toContain("target=");

  await rows.first().click();
  await expect(page.getByText("Chasing")).toBeVisible();
});
