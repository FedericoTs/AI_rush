import { expect, test } from "./fixtures";

/**
 * The installable half of Phase 7.
 *
 * These are the checks a browser can actually make. Whether it looks right on
 * a home screen under a notch is a human holding a phone, and `docs/MOBILE.md`
 * says how; what is automatable is that the manifest is valid and complete,
 * that every icon it promises is a real PNG at the size it claims, and that
 * the service worker's caching rules are the narrow ones they are supposed to
 * be — because the wrong rule there serves a stale leaderboard forever.
 */

test("the manifest is served and asks to be installed as a game", async ({ page }) => {
  const res = await page.request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);

  const m = (await res.json()) as Record<string, unknown>;
  expect(m.name).toBe("AI Rush");
  expect(m.display).toBe("standalone");
  /* Six levels put controls in fixed corners and one asks you to tilt the
     device. A layout that rotates underneath those is a broken mechanic. */
  expect(m.orientation).toBe("portrait");
  expect(m.start_url).toBe("/");
  expect(m.background_color).toBe("#0b0e13");
});

test("every icon the manifest promises is a real PNG of the size it claims", async ({ page }) => {
  const res = await page.request.get("/manifest.webmanifest");
  const m = (await res.json()) as {
    icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
  };

  /* A maskable icon is what stops Android shaving the corners off the mark. */
  expect(m.icons.some((i) => i.purpose === "maskable")).toBe(true);

  for (const icon of m.icons) {
    const img = await page.request.get(icon.src);
    expect(img.status(), `${icon.src} should be served`).toBe(200);

    const body = await img.body();
    /* PNG signature, then the IHDR width/height at a fixed offset. Cheaper and
       stricter than trusting the Content-Type header. */
    expect(body.subarray(1, 4).toString("ascii"), `${icon.src} should be a PNG`).toBe("PNG");
    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);
    expect(`${width}x${height}`, `${icon.src} should match its declared size`).toBe(icon.sizes);
  }
});

test("iOS gets its own icon, because it ignores the manifest for this", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
  expect(href).toBeTruthy();

  const img = await page.request.get(href!);
  expect(img.status()).toBe(200);
  expect((await img.body()).subarray(1, 4).toString("ascii")).toBe("PNG");
});

/*
 * The rules that keep a service worker from becoming a bug that outlives the
 * fix. A cached /api/board is a leaderboard that lies, and a cached
 * /api/run/start hands two players the same run.
 */
test("the worker never caches the API and never leaves the origin", async ({ page }) => {
  const res = await page.request.get("/sw.js");
  expect(res.status()).toBe(200);
  const src = await res.text();

  expect(src).toContain('url.pathname.startsWith("/api/")');
  expect(src).toContain("url.origin !== self.location.origin");
  /* Only GETs. A cached POST would be a submitted run replayed. */
  expect(src).toContain('req.method !== "GET"');
});

test("the offline page is honest about what still works", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "No signal." })).toBeVisible();
  /* The point of the page: a run needs no network, so it offers one. */
  await expect(page.getByRole("link", { name: /START ANYWAY/ })).toHaveAttribute("href", "/play");
});
