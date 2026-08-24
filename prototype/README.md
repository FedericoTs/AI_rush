# Prototype — L11, L12, L37

A playable vertical slice. Open `index.html` in a browser; there is no build
step, no dependency, and no server.

```
open prototype/index.html          # macOS
python3 -m http.server -d prototype 8080
```

## What it is for

One question: **are these three levels fun?** That's the Phase 2 gate in
`../docs/ROADMAP.md`, and everything downstream is wasted effort if the answer
is no. This slice exists to get the answer in an afternoon instead of a month.

It deliberately is **not** the Phase 0/1 scaffold. No Next.js, no Supabase, no
deploy pipeline. Building the real app in order to test three mechanics would
have put a week of infrastructure between the idea and the answer.

## What's real

- **The run loop.** 5:00 clock that never pauses, solve / skip / fail, level
  sequencing, tally with the overshooting slot-machine count-up.
- **Scoring, exactly as specified** in `GAME_DESIGN.md` §4 — tier base, speed
  bonus against par, combo at 1/2/3/5/8 solves, first-try bonus, skip costing
  10s and the streak. `scoreLevel()` is already a pure function and ports to
  `engine/scoring.ts` unchanged.
- **Seeded RNG** (mulberry32), used for every random decision inside a level.
  No `Math.random()` in level code.
- **The three level mechanics**, at full cruelty.
- **The slop design language** — gradient borders, three corner radii,
  trademark badges, over-explaining microcopy, a footer linking to Careers
  twice. Testing the *tone* matters as much as testing the mechanics.
- **Sound**, via WebAudio, unlocked on the first tap, muteable from the bar.
- **The level module shape.** Each level is `{ meta, mount(root, api) }`
  returning a teardown — a direct analogue of the `LevelModule` contract in
  `ARCHITECTURE.md` §3. The port to React is mechanical: `mount` becomes the
  component body, the teardown becomes the `useEffect` cleanup.

## What's faked

| Faked | Real home |
| --- | --- |
| No leaderboard, no handle, no share card | Phase 3 |
| No chaos modifiers | Phase 5 |
| No calibration / permission choreography | Phase 4 |
| Deck is a fixed array of 3, not a seeded deal | Phase 1 (`engine/deck.ts`) |
| Levels are vanilla JS + DOM, not React modules | Phase 1 |
| No telemetry | Phase 3 |
| Canvas is fixed 600×220, not DPR-aware | Phase 2 polish |

## Deviations from the spec, and why

**L12 uses ten vertical faders, not ten horizontal sliders.** The doc says
horizontal. Ten stacked horizontal sliders is roughly 400px of vertical space
on a phone, which fails the mobile-first pillar before you've touched it.
Ten vertical faders side by side fit the width, read instantly as a mixing
desk that has no business being a phone number field, and make "dragging one
scrubs its neighbour" physically obvious. `LEVELS.md` should be updated to
match if this survives playtesting.

**L12's coupling accumulates fractionally.** The first pass rounded the coupled
delta per pointer event, which meant a slow, careful drag produced `round(0.2)`
= 0 every frame and dodged the coupling entirely. Positions are now continuous
floats with the digit rounded for display, so the interference lands the same
whether you drag fast or slow. Worth carrying into the real implementation —
it's the kind of thing that quietly makes a coupled level trivial.

**L37's fail state re-seeds all four dials**, and guards against handing the
player the solved state for free.

## What to watch for in a playtest

- **L11:** does the total reset after six of seven letters read as funny or as
  hostile? This is the P3 (cruel, never tedious) judgement call, and it is the
  single riskiest thing in the catalog. Watch faces, not scores.
- **L12:** how long until someone works right-to-left? If nobody finds it
  inside par, the ordering isn't discoverable and the level is a slot machine.
- **L37:** same question, mirrored — left-to-right. L37 should be the *easier*
  discovery of the two because the propagation is visible in one action.
- **All three:** the moment of recognition. Does the card read as a normal form
  for the first second and a half (P1)? If someone's first reaction is "what am
  I looking at" rather than "oh, a password field" — the level has failed
  before its mechanic ever ran.

## Known rough edges

- Canvas is not DPR-scaled, so L11 is soft on retina displays.
- No `prefers-reduced-motion` path inside levels (chrome respects it).
- L11's difficulty is unbalanced by feel, not by data — spawn rate and the
  60% correct-letter bias are guesses awaiting real solve-time percentiles.
