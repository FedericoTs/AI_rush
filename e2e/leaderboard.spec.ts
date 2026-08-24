import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * The endgame, against the real database.
 *
 * Skips every level so the run reaches the tally in seconds, then claims a
 * throwaway handle and checks it lands on the board. Handles are randomised so
 * repeated runs do not collide on the leaderboard's one-row-per-handle rule.
 */

const handle = () => `e2e_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Skip every level until the tally.
 *
 * Waits for the level under the button to actually change rather than for a
 * fixed number of milliseconds. A deck is fourteen levels and some of them
 * mount timers, so a flat 60ms wait was occasionally clicking a button that
 * had already been replaced — which is a flaky test rather than a real one.
 */
async function skipToTally(page: Page) {
  await page.goto("/play?seed=E2E001");
  await expect(page.getByTestId("clock")).toBeVisible();

  for (let i = 0; i < 40; i++) {
    const skip = page.getByRole("button", { name: "SKIP THIS LEVEL" });
    if ((await skip.count()) === 0) break;
    const before = await page.locator("[data-level]").getAttribute("data-level");
    await skip.click();
    /* Either the next level mounted, or the run ended. Both are progress. */
    await Promise.race([
      page.locator(`[data-level]:not([data-level="${before}"])`).waitFor({ timeout: 4_000 }),
      page.getByTestId("final-score").waitFor({ timeout: 4_000 }),
    ]).catch(() => {});
  }
  await expect(page.getByTestId("final-score")).toBeVisible({ timeout: 10_000 });
}

test("a run reaches the tally and offers to claim a place", async ({ page }) => {
  await skipToTally(page);
  await expect(page.getByText("DECK CLEARED")).toBeVisible();
  await expect(page.getByRole("button", { name: /Claim your place|See the board/ })).toBeVisible();
});

test("claiming a handle puts it on the board", async ({ page }) => {
  const me = handle();
  await skipToTally(page);

  const claim = page.getByRole("button", { name: "Claim your place" });
  if ((await claim.count()) === 0) test.skip(true, "leaderboard not configured for this build");
  await claim.click();

  await page.getByLabel("Your X handle").fill(`@${me}`);
  await page.getByRole("button", { name: "Post it" }).click();

  await expect(page.getByRole("link", { name: "Post to X" })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=/#\\d/").first()).toBeVisible();

  await page.goto("/board");
  await expect(page.getByText(`@${me}`)).toBeVisible({ timeout: 10_000 });
});

test("the share link points at the same seed", async ({ page }) => {
  await skipToTally(page);
  const seed = await page.locator("text=E2E001").first().textContent();
  expect(seed).toContain("E2E001");
});

test("a rejected handle is explained, not swallowed", async ({ page }) => {
  await skipToTally(page);
  const claim = page.getByRole("button", { name: "Claim your place" });
  if ((await claim.count()) === 0) test.skip(true, "leaderboard not configured for this build");
  await claim.click();
  await page.getByLabel("Your X handle").fill("@not a valid handle!!");
  await page.getByRole("button", { name: "Post it" }).click();
  await expect(page.getByText(/not a valid X handle/i)).toBeVisible();
});

test("the board page renders and links back into a run", async ({ page }) => {
  await page.goto("/board");
  await expect(page.getByRole("link", { name: "Take your five minutes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mercy" })).toBeVisible();
});

/*
 * The run clock is a float and half the columns downstream are integers. A
 * fractional millisecond anywhere in this payload used to lose the entire run
 * to a cast error — silently, at the last step, after five minutes of play.
 */
test("a run with fractional milliseconds still lands", async ({ request }) => {
  const started = await request.post("/api/run/start", {
    data: { seed: "FRACT1", caps: "", mercy: false },
  });
  const { runId, runSecret, offline } = (await started.json()) as {
    runId?: string; runSecret?: string; offline?: boolean;
  };
  if (offline || !runId) test.skip(true, "leaderboard not configured for this build");

  const res = await request.post("/api/run/finish", {
    data: {
      runId,
      runSecret,
      durationMs: 120000.7777,
      events: [
        { seq: 1, kind: "enter", levelId: "L01", atMs: 0.4 },
        { seq: 2, kind: "solve", levelId: "L01", atMs: 4033.5999999, solveMs: 4033.5999999 },
      ],
    },
  });
  const body = (await res.json()) as { ok?: boolean; offline?: boolean; score?: number };
  expect(body.offline).toBeUndefined();
  expect(body.ok).toBe(true);
  expect(body.score).toBeGreaterThan(0);
});

test("the share card renders as a real image", async ({ request }) => {
  const res = await request.get("/api/og");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
  expect((await res.body()).byteLength).toBeGreaterThan(10_000);
});
