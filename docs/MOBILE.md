# Mobile

`ROADMAP.md` Phase 7 exits when the game is **installed from a home screen on
iOS and Android, fullscreen, with no notch collisions and a wake lock holding
for a full five minutes.**

Three of those four are shipped and testable in a browser today. The fourth —
store listings — needs an Apple Developer account and a Google Play account,
and no amount of code substitutes for that.

---

## 1. The PWA

Installable now, with no native toolchain at all. This is the version most
players will ever have, and it is not a lesser one: an installed PWA on both
platforms gets a home-screen icon, a splash, no browser chrome, and the wake
lock.

| Piece | Where |
| --- | --- |
| Manifest | `src/app/manifest.ts` → `/manifest.webmanifest` |
| Icons | `src/app/api/icon/route.tsx`, `src/app/apple-icon.tsx` |
| Service worker | `public/sw.js`, registered by `src/ui/ServiceWorker.tsx` |
| Offline page | `src/app/offline/page.tsx` |
| Wake lock | `src/ui/useWakeLock.ts`, held while `phase === "playing"` |
| Safe areas | `viewportFit: "cover"` in `layout.tsx`, insets in `globals.css` |

### Icons are rendered, not committed

The mark is a 16×16 grid. The only way it stays crisp is if every size is an
exact integer multiple of 16 with no resampling in between, and a checked-in
PNG gets resized by whatever tool touched it last. So `/api/icon?size=512`
renders it through the same `next/og` pipeline as the share card, from the same
`logoSvg()` the favicon uses. There is one drawing of this mark in the
repository and no way for an icon to drift from it.

`maskable=1` draws it at 62% instead of 84%, because Android launchers crop
maskable icons to a circle, a squircle or a teardrop and only the middle 80% is
guaranteed to survive.

### The service worker, and how to turn it off

A service worker outlives the page that installed it. If a released one turns
out to be broken, **deleting `public/sw.js` does not help** — the installed
copy keeps running on every device that has it. The only undo is a new worker,
or a page that unregisters the old one.

That escape hatch is `ENABLED` in `src/ui/ServiceWorker.tsx`. Flip it to
`false`, deploy, and the next visit unregisters the worker and drops every
cache it made.

What it caches is deliberately narrow:

- `/_next/static/**` — cache-first, forever. Content-hashed filenames, so a
  changed file is a different URL and a cached one cannot be stale.
- Navigations — network-first, cache as fallback. The pages are dynamic.
- `/api/**` — **never.** A cached `/api/board` is a leaderboard that lies.
- Cross-origin — never. Not ours, and opaque responses fill the quota.

A run needs no network once the page has loaded: the deck is dealt from a seed
in the browser and scoring is pure. So offline gives a real, complete five
minutes — the score simply never reaches the board, which is already what
happens when the database is unreachable.

### Safe areas

`body` pads left, right and bottom — **not** top. Installed on iOS with
`black-translucent`, the status bar sits *over* the page, so anything starting
at y=0 starts under the notch. Padding the body would push every page down,
including the two whose first element is their own bar, where the right answer
is the opposite: the run's HUD and the front page's masthead carry the inset
themselves so their background reaches *up* behind the phone's clock.

Everything else adds `env(safe-area-inset-top)` to its own `.shell`. **A new
page with content at y=0 has to do the same.**

### Verifying the install

- **Android/Chrome** — DevTools → Application → Manifest. "Installability" must
  show no errors; the maskable icon preview must not clip the mark.
- **iOS/Safari** — Share → Add to Home Screen. Launch it and check the status
  bar area is dark rather than a white strip, and that the HUD clock is not
  under the notch.
- **Wake lock** — start a run, put the phone down, and do nothing for two
  minutes. The screen must not dim. Then pull down the notification shade and
  dismiss it: the lock is released by the platform on hide and re-acquired on
  `visibilitychange`, so it must still be held afterwards. Unsupported on iOS
  before 16.4, where the game is playable and simply worse.

---

## 2. The native shell

Capacitor wraps the **live deployment** rather than a static export, because
the leaderboard, the share links and the seeded challenge URLs all need a
server. That makes the apps a chrome around the website: one deploy updates
web, iOS and Android at once, and a level fix does not wait on store review.

The cost, stated plainly: with `server.url` set, the app needs a network to
*start*, even though a run needs none once running. The service worker covers
that gap.

### The packages are not dependencies of this repo

`@capacitor/*` is deliberately absent from `package.json`. A website should not
need a native mobile SDK to type-check, and a contributor who only opens the
web app should not install two mobile plugins. `src/native/capacitor.d.ts`
declares the small slice used, so `src/native/index.ts` and
`capacitor.config.ts` stay type-checked without them. On the machine that
*does* install them, the real types win and any drift shows up as an error
there.

### Setup, on a machine with Xcode and/or Android Studio

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/ios @capacitor/android \
       @capacitor/haptics @capacitor/motion @capacitor/splash-screen

npx cap add ios
npx cap add android
npx cap sync
npx cap open ios       # or: npx cap open android
```

`capacitor.config.ts` is already written. `CAP_SERVER_URL` overrides the target
origin for a staging build.

### Wiring the bridge

The one thing the shell must do, before the app bundle runs:

```ts
import { installNativeBridge } from "@/native";
await installNativeBridge();
```

That fills in the registry in `src/input/native.ts`, and `createHapticsAdapter`
and `createMotionAdapter` quietly pick up the better implementations.

### Why this is the acceptance test

> swap in `@capacitor/haptics` and `@capacitor/motion` at the adapter seam —
> **zero changes in `src/levels/`** (this is the test of whether Phase 1 was
> done right)
>
> — `ROADMAP.md` Phase 7

There are none. No level's props change, `useInput` does not change, the engine
does not change. Two adapters ask a registry whether something better turned
up. `src/input/native.test.ts` asserts the contract survives the swap: a native
sample arrives through the same `subscribe`/`current`/`destroy` shape, a
haptics adapter reports itself available on a platform where `navigator.vibrate`
does not exist at all, and a plugin that throws still produces L26's flash —
because a level whose feedback channel silently dies is a level nobody can
solve.

One detail worth knowing: Capacitor's Haptics takes a single duration, while
`navigator.vibrate` takes an on/off/on/off pattern. `src/native/index.ts` walks
the pattern with timers rather than collapsing it, because L26's mechanic is
the **rhythm** — a single long buzz would destroy the puzzle.

### Still needs a human

- Apple Developer and Google Play accounts, and the signing that goes with them
- Store listings, screenshots, age rating, privacy labels
- The trailer, which is L11 followed by L35, in that order
