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

- [x] Next.js 16 + TS strict + Tailwind v4 scaffold
- [x] ESLint rules: no `Math.random()`/`Date.now()` and no store or router
      imports in `src/levels/**` — verified to fire there and nowhere else
- [x] Vitest + Playwright wired, real suites in both
- [x] GitHub Actions: typecheck, lint, test, build, e2e on PR
- [ ] Vercel project, preview deploys on PR — **needs a human**: provisioning
      attaches billing to an account
- [x] Supabase migration written (`supabase/migrations/0001_init.sql`) with RLS
- [ ] Supabase dev + prod projects provisioned — **needs a human**, same reason
- [x] A landing page that is already a joke: START is red and on the right

---

## Phase 1 — The engine ✅
**Exit met:** a six-level run plays start to finish in a real browser, on
desktop and mobile, with a working clock, scoring, skip, and exact seed
reproduction. 98 unit tests, 10 e2e.

- [x] `engine/rng.ts` — mulberry32, per-level streams, seed-link encoding
- [x] `engine/clock.ts` — injectable time and scheduling, so tests drive a run
      in microseconds and a headless agent harness can step it
- [x] `engine/store.ts` — run state machine and the append-only event log
- [x] `engine/scoring.ts` — pure, shared with the server
- [x] `engine/deck.ts` — seeded deal, every constraint from `GAME_DESIGN.md` §5
- [x] `engine/coupling/` — the graph engine and its ordering solver
- [x] `engine/chaos/modifiers.ts` — specs, mercy flags, schedule
- [ ] `engine/chaos/ChaosProvider` — the CSS-variable wrapper that *renders*
      the effects. Deferred to Phase 5 with the levels that need it; the
      schedule is built and tested, nothing draws it yet
- [x] `input/` — pointer, keyboard, motion, audioIn, camera, haptics + detection
- [x] `input/__mocks__/scripted.ts` — recorded traces for motion/audio/camera
- [x] `engine/sfx.ts` — WebAudio, gesture unlock, plus a silent test double
- [x] `ui/slop/` — the design system and the seeded phrase bank
- [x] Fourteen real levels instead of three placeholders, covering every tier:
      L01, L02, L04, L05, L11, L12, L16, L18, L22, L27, L28, L36, L37, L42

**The tests that matter most:**

- Client score and server recompute agree across 40 seeds and mixed
  solve/fail/skip orders. If those ever diverge, every leaderboard row is wrong.
- The coupling solver proves 10,000 seeds reachable on both shipped coupled
  levels, and refuses a cyclic graph outright.
- A run with every permission denied still deals a full, fair five minutes.

> **Do not skip the input layer here.** Building it after the levels means
> rewriting 48 levels for the Capacitor port. This phase is the one place where
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
- [x] **Level submission intake** — `/lab`, the table, and a Friday triage
      query. No gallery, no voting, no admin UI, as planned. Entry points on
      the endgame, the board and the front page (`COMMUNITY_LEVELS.md` §2)
- [x] **The level index and the practice room** — `/levels` lists every shipped
      level by what it *pretends* to be, never what it does; `/levels/L37`
      plays one on its own, `/levels/all` plays the lot in order. The clock
      counts up, chaos modifiers are off, and nothing is filed — a board you
      could farm one level at a time would not be worth being on
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

## Phase 5 — Content to 48 + chaos
**Exit:** eight consecutive runs with no repeated level; modifiers active from
2:00 without a single broken composition.

- [ ] **The coupled dependency-graph evaluator, first.** Typed edges
      (`propagate`, `evict`, `redistribute`, `writeback`, `relayout`) plus the
      reachability solver. Eleven levels become config once it exists
- [ ] Coupled family: L37, L39, L40, L41, L42, L43, L44, L45, L46, L47, L48
- [ ] L38 (real gear geometry on canvas) — the one bespoke build in the family
- [ ] Remaining `annoying`: L03, L04, L06, L07, L08, L09, L10
- [ ] Remaining `cursed`: L15, L16, L17, L18, L21
- [ ] Remaining `unhinged`: L23, L24, L25, L27, L29, L30
- [ ] Remaining `forbidden`: L31, L32, L33, L34
- [ ] All 12 chaos modifiers + the incompatibility matrix
- [ ] Automated composition test: every (level × modifier) pair renders,
      remains solvable, and doesn't violate `incompatibleModifiers`
- [ ] **Solvability proof over 10,000 seeds** for every coupled level, in CI.
      An unsolvable seed turns the joke into a bug report

---

## Phase 6 — The Lab
**Exit:** a submitted level idea has been built, shipped, credited, and its
author has posted about it.

- [ ] `/lab` gallery and voting (the submission form already shipped in Phase 3)
- [ ] `/api/lab/vote|remove`, rate limits, moderation queue
- [ ] Credit surfaces: in-level byline, level index, share card attribution
- [ ] Admin view for triage (can be a Supabase Studio saved query at first —
      do not build a CMS)
- [ ] First Community Drop shipped and announced

---

## Phase 6.5 — The Agent Arena
**Exit:** an agent's stated reasoning, published live, makes a stranger laugh —
same bar as Phase 2, different species.

Do this in two steps, and stop after the first if it isn't funny.

**6.5a — the week-long probe**
- [ ] MCP server with `look` / `click` / `type` / `key` / `drag` / `wait` / `skip`
- [ ] The `why` parameter, required by schema on every action
- [ ] The DOM → 48×24 character-grid rasterizer (`look()`) — the only real
      technical risk in this phase
- [ ] Point an agent at the existing 48 levels; read the transcript
- [ ] **Gate:** is watching this actually funny? If no, stop here. One week spent.

**6.5b — the mode**
- [ ] Silicon tier S1–S6 (`AGENT_ARENA.md` §5)
- [ ] `/arena` spectator page: live feed, confidence-gap scoring, highlight reel
- [ ] Separate agent leaderboard — never merged with the human board
- [ ] The human/agent asymmetry table
- [ ] Quote share cards + operator attribution
- [ ] Operator trust surface: sandbox guarantees, published-reasoning notice
      before connection, `private: true` opt-out, S1 labelled in advance

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
| A coupled level ships unsolvable | Reachability solver over 10,000 seeds in CI, and start states generated by applying N legal moves to the *solved* state rather than by shuffling. |
| The Agent Arena isn't funny, just slow | 6.5a is a one-week probe with an explicit stop gate before any spectator UI is built. |
| Agents trivially beat the game by reading the DOM | `look()` returns a character grid, never a DOM or accessibility tree. If this constraint ever loosens, the mode is pointless. |
| Community ideas dry up before the Lab ships | Intake moved to Phase 3 — one day of work, months earlier. |

## Rough shape

Phases 0–2 are the real project — everything else is addition to a thing that
already works. Phase 2's playtest is the only date worth committing to; past
that, ship phases as they finish and let the telemetry set priorities.

Two things are deliberately pulled earlier than their phase number suggests:
**submission intake** (Phase 3, because ideas are perishable) and the
**Agent Arena probe** (a single week, gated, because it's cheap to find out and
expensive to guess).
