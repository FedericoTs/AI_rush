import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { dealRound, ROUNDS } from "../src/slop/score";

/**
 * Slop Score — the ten-second door.
 *
 * Everything shareable this project makes sits behind a five-minute run, and
 * of the first thirty-eight runs ten reached the end. This is the short way
 * in, so the thing worth testing is that a stranger can finish it.
 */

const slider = (page: Page) => page.getByRole("slider", { name: /Would a real product/ });

async function answer(page: Page, value: number) {
  await slider(page).fill(String(value));
  await page.getByRole("button", { name: /Lock it in/ }).click();
  await expect(page.getByText(/off by/)).toBeVisible();
}

test("a round is five levels and can be played to the end", async ({ page }) => {
  await page.goto("/slop?r=7");
  await expect(page.getByRole("heading", { name: /SLOP/ })).toBeVisible();

  for (let i = 0; i < ROUNDS; i++) {
    /* The real level, rendered — not a screenshot and not a description. */
    await expect(page.locator("[data-preview]")).toBeVisible();
    await answer(page, 30 + i * 10);
    await page.getByRole("button", { name: /Next|See your result/ }).click();
  }

  await expect(page.getByRole("button", { name: /Copy result/ })).toBeVisible();
  await expect(page.getByText(/\/ 500/)).toBeVisible();
});

test("every round reveals before it moves on, including the last", async ({ page }) => {
  /*
   * `done` used to be "all five answered", which flipped the instant the fifth
   * guess landed and threw the player to the summary — so the one round they
   * never saw a result for was their last one.
   */
  await page.goto("/slop?r=7");
  for (let i = 0; i < ROUNDS - 1; i++) {
    await answer(page, 50);
    await page.getByRole("button", { name: "Next" }).click();
  }
  await answer(page, 50);
  await expect(page.getByRole("button", { name: /See your result/ })).toBeVisible();
});

test("the same link deals the same five to everybody", async ({ page }) => {
  /* The format is two people comparing one round. */
  const expected = dealRound(7);
  await page.goto("/slop?r=7");
  for (const id of expected) {
    await expect(page.locator(`[data-preview="${id}"]`)).toBeVisible();
    await answer(page, 50);
    await page.getByRole("button", { name: /Next|See your result/ }).click();
  }
});

test("the preview cannot be played", async ({ page }) => {
  /*
   * A level in here is a specimen, not a game. It keeps animating, because a
   * spinner that is still spinning is most of what the question is about, but
   * nothing in it can take focus or a click — otherwise the page quietly
   * becomes a worse version of the real thing.
   */
  await page.goto("/slop?r=7");
  const preview = page.locator("[data-preview]");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("inert", /.*/);

  const stuck = await page.evaluate(() => {
    const box = document.querySelector("[data-preview]");
    const first = box?.querySelector("input, button, select, textarea");
    if (!first) return "none";
    (first as HTMLElement).focus();
    return document.activeElement === first ? "focused" : "refused";
  });
  expect(stuck).not.toBe("focused");
});

test("a mangled seed still deals a game rather than an error", async ({ page }) => {
  await page.goto("/slop?r=not-a-number");
  await expect(page.locator("[data-preview]")).toBeVisible();
  await expect(slider(page)).toBeVisible();
});
