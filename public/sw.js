/*
 * The service worker.
 *
 * A service worker is the one thing in a web app that can break a site
 * permanently: it outlives the page that installed it, it answers requests
 * before the network does, and a bad one serves last week's HTML forever to
 * people who have no idea why. So the rules here are narrow on purpose and
 * every one of them is written down.
 *
 * ── What is cached ───────────────────────────────────────────────────────
 *
 *   /_next/static/**   cache-first, forever. These filenames contain a content
 *                      hash, so a changed file is a different URL and a cached
 *                      one can never be stale.
 *   navigations        network-first, cache as a fallback. The page is dynamic
 *                      — the leaderboard, the live counter, the level count all
 *                      come from the server — so the network always wins when
 *                      it is there. The cache exists for the tunnel, the lift
 *                      and the aeroplane.
 *
 * ── What is never cached ─────────────────────────────────────────────────
 *
 *   /api/**            Every one of these is either a write or a live read.
 *                      A cached /api/board is a leaderboard that lies; a
 *                      cached /api/run/start hands two players one run.
 *   anything cross-origin
 *                      Not ours to cache, and the opaque responses would fill
 *                      the quota with things we cannot inspect.
 *
 * ── Offline ──────────────────────────────────────────────────────────────
 *
 * A run needs no network once the page has loaded: the deck is dealt from a
 * seed in the browser and scoring is pure. So an offline player gets a real,
 * complete five minutes — the score simply never reaches the board, which is
 * already how the game behaves when the database is unreachable.
 */

const VERSION = "v1";
const SHELL = `ai-rush-shell-${VERSION}`;
const STATIC = `ai-rush-static-${VERSION}`;

/* The pages worth having without a network. /play is the only one that is
   genuinely playable offline; the others are here so the app does not look
   broken while it is. */
const PRECACHE = ["/", "/play", "/levels", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      /* `reload` so an install never picks the shell up out of the HTTP cache —
         installing a worker that immediately serves a stale page is the exact
         failure this whole file is trying to avoid. */
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      /* One unreachable page must not fail the whole install. */
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("ai-rush-") && k !== SHELL && k !== STATIC)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  /* Hashed and immutable. Cache-first is safe by construction here and it is
     what makes a second visit instant. */
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          /* This exact page, then the entry point, then the page that admits
             what has happened. Never a blank frame. */
          return (
            (await caches.match(req)) ||
            (await caches.match("/")) ||
            (await caches.match("/offline")) ||
            new Response("Offline.", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        }),
    );
  }
});

/* The page asks for this after an update lands, so a player is never made to
   close every tab to get a fix. */
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
