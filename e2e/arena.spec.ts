import { expect, test } from "./fixtures";
import { ARENA_KEY } from "../src/lib/agent";

/**
 * The seam that decides which of two tables a run is filed in.
 *
 * Everything else about an agent's run is deliberately identical to a
 * person's — same client, same clock, same scoring — so the *only* thing
 * standing between the Arena and a human leaderboard with a language model on
 * it is one field on one request. The unit tests cover `agentIdentity()`;
 * these cover that the value actually reaches the wire, from a real page load,
 * through the effect that opens the run.
 *
 * Failing open here is the expensive direction. A missed marker does not mean
 * a missing row, it means a machine's run counted as a person's in the one
 * table the whole asymmetry comparison is drawn from, and nothing downstream
 * can tell afterwards.
 */

/** The `agent` field of the body `/api/run/start` was called with. */
async function agentOnStart(
  page: import("@playwright/test").Page,
  url: string,
): Promise<unknown | "never-called"> {
  let seen: unknown = "never-called";

  await page.route("**/api/run/start", async (route) => {
    seen = (route.request().postDataJSON() as { agent?: unknown }).agent ?? null;
    /* Answered offline: the run proceeds unscored and the test does not write
       a row to anybody's database. */
    await route.fulfill({ status: 200, body: JSON.stringify({ offline: true }) });
  });

  await page.goto(url);
  await expect(page.locator("[data-level]")).toBeVisible({ timeout: 20_000 });
  /* The start call is fired from an effect alongside the deal, so the level
     being on screen is not proof it has gone out yet. */
  await expect.poll(() => seen, { timeout: 10_000 }).not.toBe("never-called");
  return seen;
}

test("a person is not filed as an agent", async ({ page }) => {
  expect(await agentOnStart(page, "/play")).toBeNull();
});

test("a marked run carries the agent to the server", async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key!, value!);
    },
    [ARENA_KEY, JSON.stringify({ agent: "e2e-harness", operator: "@federicots" })],
  );

  expect(await agentOnStart(page, "/play")).toEqual({
    agent: "e2e-harness",
    operator: "@federicots",
  });
});

test("the URL alone is enough, because storage can be blocked", async ({ page }) => {
  expect(await agentOnStart(page, "/play?arena=url-only-harness")).toEqual({
    agent: "url-only-harness",
  });
});

test("the asymmetry table says plainly when a column is empty", async ({ page }) => {
  await page.goto("/arena");
  await expect(page.getByRole("heading", { name: /Arena/ })).toBeVisible();

  /* Three renderings, and all three have to be honest — including this one.
     A local build has no database, and the page has to say that rather than
     draw an empty table that reads as "nobody can solve anything". */
  const noDb = page.getByText("No database on this build");
  if (await noDb.isVisible()) return;

  /* Either agents have played or they have not. What must never appear is a
     percentage in a column nobody has played — the whole point of
     `MIN_SEEN` — so an empty agent side has to announce itself. */
  if (await page.getByText("No agent has played yet").isVisible()) {
    await expect(page.getByText("Nothing on this table is a comparison yet")).toBeVisible();
  }
  await expect(page.getByText("never touch the leaderboard")).toBeVisible();
});
