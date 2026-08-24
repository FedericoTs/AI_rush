# Roadmap

Nine phases. Each has an **exit criterion** — a thing that is either true or
not. No phase is "done" because time passed.

The ordering principle: **get to a recordable 5-minute run as early as
possible**, because the only real test of this game is whether someone laughs
and films it. Everything before that is scaffolding, everything after is
volume.

---

## Phase 0 — Foundations
**Exit:** a URL exists, CI is green, and the landing page is already a joke.

- [ ] Next.js 15 + TS strict + Tailwind v4 scaffold
- [ ] ESLint rules: no `Math.random()` in `src/levels/**`, no store imports in `src/levels/**`
- [ ] Vitest + Playwright wired, one trivial test each
- [ ] GitHub Actions: typecheck, lint, test on PR
- [ ] Vercel project, preview deploys on PR
- [ ] Supabase dev + prod projects, CLI migrations in CI
- [ ] A "coming soon" page that is itself a cursed interface (email signup where
      the submit button is red and on the left) — ships day one, collects
      signups, and is the first content test

---

## Phase 1 — The engine
**Exit:** a run of 3 placeholder levels plays start-to-finish with a working
clock, score, skip, and seed reproduction.

- [ ] `engine/rng.ts` — mulberry32, per-level streams, unit tested for determinism
- [ ] `engine/clock.ts` — single rAF loop, `useGameClock()`, time-scalable for tests
- [ ] `engine/store.ts` — Zustand run state machine (title → calibration → level → tally → …)
- [ ] `engine/scoring.ts` — **pure**, shared with the server, exhaustively unit tested
- [ ] `engine/deck.ts` — seeded deal + all constraints from `GAME_DESIGN.md` §5
- [ ] `engine/chaos/` — modifier provider, CSS-variable wrapper, composition rules
- [ ] `input/` — the full adapter layer + capability detection (`ARCHITECTURE.md` §4)
- [ ] `input/adapters/__mocks__/` — scripted traces for motion/audio/camera, so
      sensor levels are testable in CI from day one
- [ ] `SfxManager` — preload, gesture unlock, buses
- [ ] `ui/slop/` — the slop design system + seeded phrase bank
- [ ] 3 placeholder levels exercising: pointer-only, keyboard-only, sensor+fallback

> **Do not skip the input layer here.** Building it after the levels means
> rewriting 36 levels for the Capacitor port. This phase is the one place where
> being slow is correct.

---

## Phase 2 — The first eight levels
**Exit:** somebody who isn't us plays a full 5 minutes and laughs out loud at
least twice. This is the real gate on the whole project.

Build order (chosen so the run is playable and funny at every point):

- [ ] **L01** Continue To Your Account — teaches the thesis, 2 hours
- [ ] **L02** One-Time Passcode — pure state, no new systems
- [ ] **L36** Sign In (The Honest Level) — nearly free, best joke, morale
- [ ] **L28** Are You Still There? — first use of the fleeing/pointer system
- [ ] **L05** Accept Our Cookies — copy-heavy, tests the slop phrase bank
- [ ] **L22** Loading Your Dashboard — tests chrome/level boundary
- [ ] **L12** Enter Your Phone Number — flagship #1, slider physics
- [ ] **L11** Choose A Secure Password 🦖 — flagship #2, canvas runner at 60fps

**Playtest protocol:** 5 people, unprompted, screen recorded with audio, no
explanation beyond "play this." Count laughs. Note every moment of *confused
silence* — confused silence is the failure mode, not difficulty. Rebalance par
times from the recordings before Phase 3.

If Phase 2 doesn't produce laughs, **stop and fix the levels.** Do not build a
leaderboard for a game nobody enjoys.

---

## Phase 3 — Leaderboard, endgame, share
**Exit:** a stranger can play, land on a public board, and post a card to X that
makes sense to someone who has never seen the game.

- [ ] Supabase schema + RLS + migrations (`BACKEND.md` §1–2)
- [ ] `/api/run/start|event|finish|claim` with run tokens
- [ ] Server-side score recomputation + the rejection checks (`BACKEND.md` §4)
- [ ] The endgame cutscene (`VIRALITY.md` §1) — freeze, shatter, tally
- [ ] **The slam** (`VIRALITY.md` §2) — this gets its own week, it is the
      moment the whole endgame is built around
- [ ] `/api/og` share card + percentile variants + edge caching
- [ ] Post-to-X intent with the randomized text bank
- [ ] `/r/[seed]` seeded challenge entry + ghost bar + head-to-head card
- [ ] PostHog events for the balance loop

---

## Phase 4 — Sensors
**Exit:** a phone player and a desktop player can play the same seed, both get
a complete run, and neither one's experience feels like the broken version.

- [ ] Calibration / Level 0, with the full permission choreography
- [ ] **L13** Confirm With A Gesture (gyro) + desktop fallback
- [ ] **L14** Please Confirm Verbally (mic) + dead-mic detection + fallback
- [ ] **L19** Upload A Photo Of Yourself (camera) + ASCII-face fallback
- [ ] **L26** Emergency Verification (haptics) — **build the flash/audio
      fallback first**, it is the iOS-majority path
- [ ] **L35** Please Stand Up (accelerometer) + honour-system fallback
- [ ] **L20** Confirm You're Nearby (multi-touch) + desktop three-input variant
- [ ] Deny-everything test: a run with all permissions refused must be complete,
      fair, and never nag. Automated in Playwright.

---

## Phase 5 — Content to 36 + chaos
**Exit:** eight consecutive runs with no repeated level; modifiers active from
2:00 without a single broken composition.

- [ ] Remaining `annoying`: L03, L04, L06, L07, L08, L09, L10
- [ ] Remaining `cursed`: L15, L16, L17, L18, L21
- [ ] Remaining `unhinged`: L23, L24, L25, L27, L29, L30
- [ ] Remaining `forbidden`: L31, L32, L33, L34
- [ ] All 12 chaos modifiers + the incompatibility matrix
- [ ] Automated composition test: every (level × modifier) pair renders,
      remains solvable, and doesn't violate `incompatibleModifiers`

---

## Phase 6 — The Lab
**Exit:** a submitted level idea has been built, shipped, credited, and its
author has posted about it.

- [ ] `/lab` gallery, submission form (the clean one), voting
- [ ] `/api/lab/submit|vote|remove`, rate limits, moderation queue
- [ ] Credit surfaces: in-level byline, level index, share card attribution
- [ ] Admin view for triage (can be a Supabase Studio saved query at first —
      do not build a CMS)
- [ ] First Community Drop shipped and announced

---

## Phase 7 — Mobile
**Exit:** installed from a home screen on iOS and Android, fullscreen, no
notch collisions, wake lock holding for a full 5 minutes.

- [ ] PWA: manifest, service worker, offline level caching, wake lock
- [ ] Orientation lock + safe-area insets audited on every level
- [ ] Capacitor wrapper; swap in `@capacitor/haptics` and `@capacitor/motion`
      at the adapter seam — **zero changes in `src/levels/`** (this is the test
      of whether Phase 1 was done right)
- [ ] Native audio session — the "big sounds" work without autoplay fights
- [ ] Store listings, screenshots, the trailer (which is L11 and L35, in that
      order)

---

## Phase 8 — Balance and launch
**Exit:** launched, and the weekly telemetry review has a home.

- [ ] Rebalance par times and tiers from real solve-time percentiles
- [ ] Cut or fix any level with >60% skip rate (unreadable) or <5s median
      first-try solve (free points)
- [ ] Performance pass against the budget in `ARCHITECTURE.md` §9 on a real
      mid-range Android
- [ ] Photosensitivity warning, Mercy Mode, reduced-motion audit — the honesty
      clause verified end to end, not just implemented
- [ ] Load test the share-card cache against a 50k-request spike
- [ ] Launch

---

## Sequencing risks

| Risk | Mitigation |
| --- | --- |
| Levels aren't actually funny | Phase 2 is a hard gate with real playtesters. Nothing downstream is built until it passes. |
| Input layer bolted on late | It's Phase 1, before any real level. The Phase 7 Capacitor swap is its acceptance test. |
| L11's runner tanks framerate on cheap Android | Canvas + object pools from the start; it's the last thing in Phase 2 so there's time to cut it to a simpler minigame if profiling says so. |
| Leaderboard gets flooded with fake scores | Server-side scoring from the event log ships *with* the leaderboard in Phase 3, not after. |
| iOS haptics don't exist | Assumed from the start; L26's fallback is treated as the primary path. |
| Content starvation after launch | Phase 6 exists, and the monthly retire-worst-two rule keeps the deck sharp rather than merely large. |
| The game hurts photosensitive players | Honesty clause constraints are in the modifier specs themselves (no strobe >3Hz, hue rotation capped at 0.4Hz), not left to a final audit. |

## Rough shape

Phases 0–2 are the real project — everything else is addition to a thing that
already works. Phase 2's playtest is the only date worth committing to; past
that, ship phases as they finish and let the telemetry set priorities.
