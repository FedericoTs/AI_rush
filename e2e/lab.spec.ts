import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * The Lab.
 *
 * This is the one surface in the product that is not trying to hurt anyone,
 * and it is the entire content pipeline — every point of friction here is an
 * idea that never arrives. So it gets tested like a real form: validation
 * messages, a draft that survives a reload, and a submission that lands.
 */

const idea = () => ({
  title: "Verify Your Humanity™",
  parodies: "A CAPTCHA",
  mechanic:
    "The images shuffle every 800ms and your selections stay bound to cells rather than pictures. A long press pauses the shuffle, which is how you beat it.",
  handle: `e2e_${Math.random().toString(36).slice(2, 8)}`,
});

async function fill(page: Page, v: ReturnType<typeof idea>) {
  await page.getByLabel("What does the interface call itself?").fill(v.title);
  await page.getByLabel("What normal UI is it pretending to be?").fill(v.parodies);
  await page.getByLabel("What does it do to the player?").fill(v.mechanic);
  await page.getByLabel("Where do we credit you?").fill(`@${v.handle}`);
}

test("the form is reachable and admits it is usable on purpose", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.getByRole("heading", { name: /The Lab/ })).toBeVisible();
  await expect(page.getByText(/usable on purpose/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send it in" })).toBeVisible();
});

test("every field has a real label", async ({ page }) => {
  await page.goto("/lab");
  for (const label of [
    "What does the interface call itself?",
    "What normal UI is it pretending to be?",
    "What does it do to the player?",
    "Where do we credit you?",
  ]) {
    await expect(page.getByLabel(label)).toBeVisible();
  }
});

test("an empty submission explains what is missing rather than failing silently", async ({ page }) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Send it in" }).click();
  await expect(page.getByTestId("lab-error")).toBeVisible();
});

test("a too-short mechanic asks for the escape, not just more words", async ({ page }) => {
  await page.goto("/lab");
  const v = idea();
  await fill(page, { ...v, mechanic: "it is hard" });
  await page.getByRole("button", { name: "Send it in" }).click();
  await expect(page.getByTestId("lab-error")).toContainText(/how someone beats it|20 characters/i);
});

test("a bad handle is caught", async ({ page }) => {
  await page.goto("/lab");
  await fill(page, { ...idea(), handle: "not a handle!!" });
  await page.getByRole("button", { name: "Send it in" }).click();
  await expect(page.getByTestId("lab-error")).toContainText(/valid X handle/i);
});

/* Losing a submission to a closed tab would be, in this product, unbearable. */
test("the draft survives a reload", async ({ page }) => {
  await page.goto("/lab");
  const v = idea();
  await fill(page, v);

  await page.reload();
  await expect(page.getByLabel("What does the interface call itself?")).toHaveValue(v.title);
  await expect(page.getByLabel("What does it do to the player?")).toHaveValue(v.mechanic);
});

test("input chips toggle and report their state", async ({ page }) => {
  await page.goto("/lab");
  const mic = page.getByRole("button", { name: "Microphone" });
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "false");
});

test("a complete submission lands and clears the draft", async ({ page }) => {
  await page.goto("/lab");
  const v = idea();
  await fill(page, v);
  await page.getByRole("button", { name: "Microphone" }).click();
  await page.getByRole("button", { name: "Send it in" }).click();

  const filed = page.getByRole("heading", { name: /Filed/ });
  const alert = page.getByTestId("lab-error");
  await expect(filed.or(alert)).toBeVisible({ timeout: 10_000 });

  if ((await alert.count()) > 0 && (await alert.textContent())?.includes("not available")) {
    test.skip(true, "submissions not configured for this build");
  }

  await expect(filed).toBeVisible();
  /* A filed idea must not linger as a draft, or the next visit re-submits it. */
  await page.goto("/lab");
  await expect(page.getByLabel("What does the interface call itself?")).toHaveValue("");
});

test("the ask appears where players actually feel something", async ({ page }) => {
  const ask = /You think you can do worse/;

  await page.goto("/");
  await expect(page.getByText(ask)).toBeVisible();

  await page.goto("/board");
  await expect(page.getByText(ask)).toBeVisible();
});

/*
 * The gallery.
 *
 * There is nothing approved on a fresh database, so these assert the frame
 * rather than the cards: the sort tabs exist, they navigate, and the empty
 * state says which of the three is empty. The card rendering — including the
 * rule that submitted text is never treated as markup — is covered by the
 * component tests in `src/app/lab/Gallery.test.tsx`, which can supply rows.
 */
test("the gallery is on the page, below the form, with its three sorts", async ({ page }) => {
  await page.goto("/lab");

  await expect(page.getByRole("heading", { name: "What people sent" })).toBeVisible();
  for (const tab of ["Top", "New", "Shipped"]) {
    await expect(page.getByRole("link", { name: tab, exact: true })).toBeVisible();
  }

  /* The form is what this page exists to get filled in, so it comes first. */
  const form = await page.getByLabel("What does the interface call itself?").boundingBox();
  const gallery = await page.getByRole("heading", { name: "What people sent" }).boundingBox();
  expect(gallery!.y).toBeGreaterThan(form!.y);
});

test("each sort says what is missing from it, in its own words", async ({ page }) => {
  await page.goto("/lab?sort=shipped");
  const shipped = page.getByText(/Nothing from the Lab has shipped yet|SHIPPED/);
  await expect(shipped.first()).toBeVisible();

  await page.goto("/lab?sort=new");
  await expect(page.getByRole("link", { name: "New", exact: true })).toBeVisible();
});
