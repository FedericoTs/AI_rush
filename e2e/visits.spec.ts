import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { isArrival } from "../src/visits/paths";

/**
 * Counting arrivals, first-party.
 *
 * Vercel's Web Analytics became a paid feature and a third-party script is the
 * wrong answer for this project rather than merely a costly one — the footer
 * promises "no account, no email, nothing to install". So this is a beacon and
 * thirty lines of SQL, and what needs testing is the part that would rot
 * silently: what it is allowed to say about a visitor.
 */

/** `sendBeacon` hands over a Blob, which Playwright cannot read off a request. */
async function captureBeacons(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __beacons: string[] }).__beacons = [];
    const real = navigator.sendBeacon?.bind(navigator);
    Object.defineProperty(navigator, "sendBeacon", {
      value: (url: string, data: BlobPart) => {
        if (String(url).includes("/api/view") && data instanceof Blob) {
          void data.text().then((t) => (window as unknown as { __beacons: string[] }).__beacons.push(t));
        }
        return real ? real(url, data as BodyInit) : true;
      },
      configurable: true,
    });
  });
}

const beacons = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __beacons: string[] }).__beacons.map(
      (b) => JSON.parse(b) as { path: string; ref: string; first: boolean },
    ),
  );

test("an arrival is counted once, with where it came from", async ({ page }) => {
  await captureBeacons(page);
  await page.setExtraHTTPHeaders({ referer: "https://x.com/someone/status/1" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "⚠ START" })).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __beacons: string[] }).__beacons.length > 0);

  const sent = await beacons(page);
  expect(sent).toHaveLength(1);
  expect(sent[0]!.path).toBe("/");
  expect(sent[0]!.first).toBe(true);
  expect(sent[0]!.ref).toContain("x.com");
});

test("clicking around the site is never a new arrival", async ({ page }) => {
  /*
   * `document.referrer` still holds whoever linked to the *first* page after a
   * client-side navigation, so counting it again would credit them with every
   * internal click and make one visitor look like a campaign.
   */
  await captureBeacons(page);
  await page.setExtraHTTPHeaders({ referer: "https://x.com/someone/status/1" });
  await page.goto("/");
  await page.getByRole("link", { name: /Not ready for five minutes/ }).click();
  await expect(page.getByRole("slider", { name: /Would a real product/ })).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __beacons: string[] }).__beacons.length > 1);

  const sent = await beacons(page);
  expect(sent[0]!.first).toBe(true);
  const later = sent.slice(1);
  expect(later.length).toBeGreaterThan(0);
  for (const b of later) expect(b.first).toBe(false);
});

test("nothing after the first view can become an arrival", async ({ page }) => {
  /*
   * The bug a real phone found and this suite did not.
   *
   * `/play` 307s to add a seed. On that phone it resolved as a full document
   * load, so the in-document flag reset and the view reported itself as new;
   * the referrer was our own host, so it was dropped as internal and the
   * phantom landed in `(direct)`. Real traffic would have split between its
   * true source and direct, and arrivals inflated by everyone who pressed
   * START.
   *
   * The previous test clicked through to `/slop`, which does not redirect, so
   * it only ever saw a soft navigation — and locally this one is soft too.
   * Rather than pretend to reproduce a hard load, this asserts the rule
   * itself, with the real function, against the real payloads: however the
   * browser resolves the navigation, exactly one view in a session is an
   * arrival.
   */
  await captureBeacons(page);
  await page.setExtraHTTPHeaders({ referer: "https://x.com/someone/status/1" });
  await page.goto("/");
  await page.getByRole("link", { name: "⚠ START" }).click();
  await page.waitForURL(/\/play\?seed=/);
  await page.waitForFunction(() => (window as unknown as { __beacons: string[] }).__beacons.length > 1);

  const self = new URL(page.url()).hostname;
  const sent = await beacons(page);
  expect(sent.length).toBeGreaterThan(1);
  expect(sent.filter((b) => isArrival(b.first, b.ref, self))).toHaveLength(1);
  expect(sent.find((b) => isArrival(b.first, b.ref, self))!.path).toBe("/");
});

test("the query string never leaves the browser", async ({ page }) => {
  /*
   * A run URL carries a seed, the handle of whoever is being raced, and their
   * score. None of that is needed to count a visit and one of them names a
   * person, so what is reported is the route and nothing else.
   */
  await captureBeacons(page);
  await page.goto("/play?seed=F4DA728E&vs=@somebody&target=7360");
  await page.waitForFunction(() => (window as unknown as { __beacons: string[] }).__beacons.length > 0);

  const sent = await beacons(page);
  expect(sent[0]!.path).toBe("/play");
  const all = JSON.stringify(sent);
  expect(all).not.toContain("F4DA728E");
  expect(all).not.toContain("somebody");
  expect(all).not.toContain("7360");
});
