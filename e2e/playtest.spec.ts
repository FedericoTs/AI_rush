import { expect, test } from "./fixtures";

/**
 * The observer bar (`docs/PLAYTEST.md`).
 *
 * Two things are worth a browser to prove, and they are the two the whole kit
 * rests on: that it is genuinely invisible unless somebody asked for it, and
 * that a shortcut pressed over a text level tags the moment instead of being
 * typed into the field.
 */

const SEED = "ABC123";

test("the bar does not exist on an ordinary run", async ({ page }) => {
  await page.goto(`/play?seed=${SEED}`);
  await expect(page.getByTestId("clock")).toBeVisible();
  await expect(page.getByTestId("observer-bar")).toHaveCount(0);
});

test("observe=1 attaches the bar and counts what it is told", async ({ page }) => {
  await page.goto(`/play?seed=${SEED}&observe=1`);
  const bar = page.getByTestId("observer-bar");
  await expect(bar).toBeVisible();

  await page.getByTestId("mark-laugh").click();
  await page.getByTestId("mark-laugh").click();
  await page.getByTestId("mark-confused").click();

  await expect(page.getByTestId("mark-laugh")).toContainText("2");
  await expect(page.getByTestId("mark-confused")).toContainText("1");
  await expect(page.getByTestId("mark-rage")).toContainText("0");
});

/*
 * The reason the shortcut is Alt+digit rather than a digit.
 *
 * This types into whatever the level put on screen first, then fires the
 * shortcut over the top of it, and asserts the field is unchanged. A bare `1`
 * would have landed in the input and quietly corrupted both the run and the
 * mark.
 */
test("a shortcut over a focused field tags the moment without typing into it", async ({ page }) => {
  await page.goto(`/play?seed=${SEED}&level=L02&observe=1`);
  await expect(page.getByTestId("observer-bar")).toBeVisible();

  const cells = page.locator("[data-testid^='otp-cell-']");
  await cells.first().click();
  await page.keyboard.type("4");
  const before = await cells.allTextContents();

  await page.keyboard.press("Alt+1");
  await page.keyboard.press("Alt+2");

  /* The passcode reads exactly as it did: the shortcut was consumed before it
     reached the field, which is the whole reason it carries a modifier. */
  expect(await cells.allTextContents()).toEqual(before);
  await expect(page.getByTestId("mark-laugh")).toContainText("1");
  await expect(page.getByTestId("mark-confused")).toContainText("1");
});

test("the session is offered at the tally, and only under observe", async ({ page }) => {
  await page.goto(`/play?seed=${SEED}&level=L36&observe=1`);
  await page.getByTestId("mark-laugh").click();

  await page.getByLabel("Email address").fill("someone@example.com");
  await page.getByLabel("Password", { exact: true }).fill("hunter22");
  await page.getByRole("button", { name: "Sign in" }).click();

  const box = page.getByTestId("observer-export");
  await expect(box).toBeVisible();
  await expect(box).toContainText("1 laugh ·");

  await page.getByTestId("observer-subject").fill("P1 · desktop · cold");
  await expect(page.getByTestId("observer-save")).toBeEnabled();
});
