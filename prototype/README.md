# Prototype — six levels

A playable vertical slice. Open `index.html` in a browser; there is no build
step, no dependency, and no server.

```
open prototype/index.html          # macOS
python3 -m http.server -d prototype 8080

npm i playwright && node prototype/smoke.mjs   # headless check, all six levels
```

## The deck

`L01 → L02 → L12 → L11 → L37 → L36`

Ordered by the two rules from `GAME_DESIGN.md` §5: a tier ramp
(annoying, annoying, cursed ×3, forbidden) and **no two consecutive levels
sharing an input family** — meta, text, coupled, motor, coupled, meta.

| | Level | Tier | Par | The bit |
| --- | --- | --- | --- | --- |
| L01 | Continue To Your Account | annoying | 10s | Cancel is the big green one. Continue is red with a warning triangle. |
| L02 | One-Time Passcode | annoying | 20s | Typing stuffs all six digits into one cell. Focus never advances. |
| L12 | Enter Your Phone Number | cursed | 25s | Ten faders; dragging one drags its left neighbour by half the delta. |
| L11 | Choose A Secure Password 🦖 | cursed | 25s | Collect SUNSET7 by jumping. One wrong letter resets everything. |
| L37 | Set Your Security PIN | cursed | 30s | A gear train — turning a dial turns every dial to its right. |
| L36 | Sign In | forbidden | 20s | Nothing. It is a completely normal login form. |

## What it is for

One question: **are these levels fun?** That's the Phase 2 gate in
`../docs/ROADMAP.md`, and everything downstream is wasted effort if the answer
is no. This slice exists to get the answer in an afternoon instead of a month.

It deliberately is **not** the Phase 0/1 scaffold. No Next.js, no Supabase, no
deploy pipeline. Building the real app in order to test six mechanics would
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
- **All six level mechanics**, at full cruelty.
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
| Deck is a fixed array of 6, not a seeded deal | Phase 1 (`engine/deck.ts`) |
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

**L36 never calls `api.fail()`.** A validation message on the honest form
produces no screen flash, no shake, and no lost first-try bonus — it is just a
form telling you something true. Any punishment feedback there would be a tell,
and the entire level depends on being exactly what it appears to be. The form
is also built to a genuinely higher standard than the slop cards around it:
real `<label>`s, a working password reveal, correct `autocomplete` attributes,
sane tab order, visible focus rings, and honest error copy.

**L36 appears in every prototype run**, where the spec says 1 run in 8. Watching
people react to it is the point of having it here. Be aware it distorts the
score: at 1000 base it is worth more than the other five levels combined, which
is correct for a level you rarely see and misleading in a six-level deck.

**The title screen no longer uses the green-Cancel/red-Continue dialog** — that
belongs to L01, and running the same joke twice inside thirty seconds blunts
both. The title keeps a red START on the right and nothing else.

## What to watch for in a playtest

- **L11:** does the total reset after six of seven letters read as funny or as
  hostile? This is the P3 (cruel, never tedious) judgement call, and it is the
  single riskiest thing in the catalog. Watch faces, not scores.
- **L12:** how long until someone works right-to-left? If nobody finds it
  inside par, the ordering isn't discoverable and the level is a slot machine.
- **L37:** same question, mirrored — left-to-right. L37 should be the *easier*
  discovery of the two because the propagation is visible in one action.
- **L01:** does anyone click Cancel twice? The 400ms style-swap on the fail path
  is the whole level, and if nobody gets caught by it the timing is wrong.
- **L02:** does the overflowing cell read as *the form's fault* or as *their*
  fault? It has to read as the form's. Note that a stuffed cell 0 holds the
  literally correct code and is still rejected — check whether that lands as
  funny or as unfair.
- **L36:** the one to actually measure. Time from mount to first keystroke, and
  how much of the run they burn hunting for a trap. Expect 4× par. If people
  solve it in ten seconds without hesitating, the five levels before it did not
  do their job.
- **All three:** the moment of recognition. Does the card read as a normal form
  for the first second and a half (P1)? If someone's first reaction is "what am
  I looking at" rather than "oh, a password field" — the level has failed
  before its mechanic ever ran.

## Known rough edges

- Canvas is not DPR-scaled, so L11 is soft on retina displays.
- No `prefers-reduced-motion` path inside levels (chrome respects it).
- L11's difficulty is unbalanced by feel, not by data — spawn rate and the
  60% correct-letter bias are guesses awaiting real solve-time percentiles.
