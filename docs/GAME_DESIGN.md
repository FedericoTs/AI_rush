# Game Design

## 1. The one-sentence pitch

*You get five minutes to survive as many hostile AI-generated interfaces as you
can, and then the internet finds out how you did.*

## 2. Design pillars

These are the tie-breakers. When a design question comes up, the answer is
whichever option serves the highest pillar.

### P1 — Recognition first, betrayal second

Every level must be **instantly legible as a normal UI** for about 1.5 seconds.
A login form. An OTP box. A date picker. A cookie banner. The player's muscle
memory has to engage *before* the level reveals what it actually is.

A level that looks weird from frame one is not funny — it's just a puzzle. The
comedy is the gap between "oh, a password field" and "oh **no**, a password
field."

> **Rule:** if a screenshot of the first second of your level doesn't look like
> a boring SaaS form, redesign it.

### P2 — The player must be able to name what went wrong

After failing, the player has to be able to finish the sentence *"it made me
___."* — "…pick each OTP digit by hand", "…scream at my phone", "…tilt my
laptop." That sentence is the share text. That sentence is the whole marketing
plan.

Levels whose failure is diffuse ("it was just confusing") are cut.

### P3 — Cruel, never tedious

Restarting from scratch is fine **because levels are short**. A level whose
full solve is 15–25 seconds can punish a mistake with a total reset and stay
funny. A level whose solve is 90 seconds cannot — that's just a bad day.

> **Rule:** target solve time ≤ 25s for `annoying`/`cursed`, ≤ 45s for
> `unhinged`/`forbidden`. If a level's honest solve time exceeds its budget,
> cut steps, don't cut the cruelty.

### P4 — The chrome is in on it

The timer, the score counter, the skip button, the loading spinners, the toast
notifications — these are not neutral UI. They intrude, they lie, they
occasionally become the level. The player should never feel fully safe in the
frame.

But: **the timer never lies about the timer.** One thing must be trustworthy or
the whole run becomes noise. The clock is sacred.

### P5 — Input maximalism

If a device can sense it, a level can demand it. Gyroscope, microphone, camera,
haptics, multi-touch, orientation, the physical act of standing up. This is the
pillar that makes AI Rush a *mobile* game rather than a webpage, and it is the
main thing competitors won't copy.

Corollary: **no run may ever hard-block on a missing sensor.** Every
sensor level has a defined degraded path. See `ARCHITECTURE.md` §5.

### P6 — Funny beats hard

If a level is brutally difficult but nobody laughs, it's a bad level. If a level
is trivially easy but everybody laughs, it stays. The ceiling on this game is
"people record their screen and post it," not "people master it."

## 3. The run loop

```
  ┌─────────────┐
  │  TITLE      │  a cursed landing page; START is a red button on the right
  └──────┬──────┘
         │
  ┌──────▼──────────────────────────────────────────────┐
  │  CALIBRATION (Level 0)                              │
  │  A fake "system check" that is really the permission│
  │  prompt choreography. Also teaches SOLVE vs SKIP.   │
  └──────┬──────────────────────────────────────────────┘
         │
  ┌──────▼──────┐   solve  ┌─────────────┐
  │  LEVEL n    ├─────────►│  +score     │
  │             │          │  +combo     │
  │  [ SKIP ]   ├──skip───►│  -10s clock │──┐
  └──────┬──────┘          │  combo → 1x │  │
         │ fail            └─────────────┘  │
         └── reset level (no clock penalty) │
                                            │
         ┌──────────────────────────────────┘
         │  global clock > 0 ?
    yes  │                    no
   ◄─────┘                     │
                        ┌──────▼──────┐
                        │  TALLY      │  slot-machine score count-up
                        └──────┬──────┘
                        ┌──────▼──────┐
                        │  HANDLE     │  type your @ (through a cursed input)
                        └──────┬──────┘
                        ┌──────▼──────┐
                        │  LEADERBOARD│  your row slams up from below
                        └──────┬──────┘
                        ┌──────▼──────┐
                        │  SHARE      │  X card + seed link + "submit a level"
                        └─────────────┘
```

### Timing

- **Global clock: 5:00.** Counts down continuously from the first level.
  Never pauses. Not for permission prompts, not for popups. (This is why the
  permission choreography happens in Calibration, *before* the clock starts.)
- **Skip costs 10 seconds** off the global clock and resets the combo
  multiplier to 1×. Skipping is always available and always instant — there is
  no "are you sure" (that would be the cruelty of a worse game).
- **Failing a level costs nothing but the wall-clock time you burn.** The level
  resets in place. This is the crucial balance valve: it keeps P3 honest.
- **Last 30 seconds:** the UI starts visibly degrading — colour cycling, the
  timer grows, a heartbeat sfx. Purely cosmetic pressure.

## 4. Scoring

| Component | Formula |
| --- | --- |
| Base | tier value: `annoying` 100 · `cursed` 250 · `unhinged` 500 · `forbidden` 1000 |
| Speed bonus | `floor(base × max(0, 1 − solveMs / (parSeconds × 1000)) × 0.5)` |
| Combo | `×1.0, ×1.2, ×1.5, ×2.0, ×3.0` at 1/2/3/5/8 consecutive solves, capped ×3 |
| First-try bonus | `+100` if solved with zero fails |
| Skip | `0` points, `−10s`, combo → ×1 |

**Level score** = `round((base + speedBonus + firstTryBonus) × combo)`

**Run score** = sum of level scores. Displayed with commas and an absurd number
of trailing zeros in the tally animation before settling on the truth.

### Why combo matters

Combo is what makes skipping a *decision* rather than a free escape hatch. At
×3, walking away from a level you could have solved is expensive. That tension —
"do I bail on this nightmare and lose my streak?" — is the strategic layer under
the comedy.

### Anti-inflation

Scores are recomputed server-side from a signed event log; the client's number
is advisory only. See `BACKEND.md` §4. A leaderboard whose top entry is
`999999999` is a dead leaderboard.

## 5. Difficulty ramp and the deck

Levels are dealt from a **seeded shuffled deck**, not chosen at random per
level, so that:

- a seed reproduces a run exactly (this is the share/challenge mechanic), and
- no level repeats within a run.

Deck construction for seed `S`:

```
minutes 0:00–1:15   →  draw from  annoying              (≈4 levels)
minutes 1:15–2:45   →  draw from  annoying + cursed     (≈4 levels)
minutes 2:45–4:15   →  draw from  cursed + unhinged     (≈3 levels)
minutes 4:15–5:00   →  draw from  unhinged + forbidden  (≈2 levels)
```

Plus hard constraints applied at deal time:

- No two consecutive levels may share a primary input modality (no two
  gyro levels back to back).
- At most one `mic` or `camera` level per run — permission fatigue is real
  fatigue, not funny fatigue.
- **The Honest Level** (see `LEVELS.md` #36) appears in exactly 1 run in 8, and
  never before minute 2:00.
- Chaos modifiers begin at minute 2:00 and stack up to 2 concurrently.

## 6. Tone and art direction

The visual language is **"the median of every landing page an LLM has ever
produced."** Specifically:

- Inter / system-ui, but with random weight jumps
- Purple-to-blue gradients on everything, including things that are not buttons
- Rounded corners at 3 different radii in the same card
- Glassmorphism applied to opaque elements
- Emoji in headings: 🚀 ✨ 🔒 — always slightly wrong for the context
- Microcopy that over-explains: *"Great! Let's get you verified — it only takes
  a moment! ✨"*
- Trademark symbols on ordinary nouns: `Verify Your Humanity™`
- A footer with links to `Privacy`, `Terms`, `Careers`, and `Careers` again
- Skeleton loaders that never resolve into content
- The phrase "AI-powered" applied to a checkbox

The joke is not "this is ugly." The joke is **"this is expensive-looking and
completely deranged."** Everything should look like it shipped, with a design
review, at a company with a Series B.

### Sound

Loud, over-produced, and constantly present. Every interaction has a satisfying
UI click that is slightly too loud. Failures get a full descending
brass-and-sad-trombone stinger. Solves get a slot-machine payout. The last 30
seconds add a heartbeat. Muting is available but the mute button is, of course,
hard to find on the first run (and permanently easy after — we're cruel, not
evil; see §8).

## 7. Session length and retention

- One run is 5 minutes. That is the whole product.
- The retention loop is **the seed link**: you share a run, your friends play
  *your exact run*, and the comparison is meaningful.
- Secondary loop: **the Lab** — you submit a level idea, and if it ships, your
  handle is on it forever. See `COMMUNITY_LEVELS.md`.
- We are not adding daily quests, energy systems, or currency. The game is a
  joke with a leaderboard; monetization and retention scaffolding would kill it.

## 8. The honesty clause (accessibility)

This game is deliberately hostile. That is fine — it's the premise. What is not
fine is hurting people who came to laugh.

Non-negotiable, always on:

- **Photosensitivity warning** on the title screen, before anything flashes.
- **No strobing above 3 Hz**, ever, in any modifier or transition.
- `prefers-reduced-motion` is respected by all *chrome* — menus, the tally, the
  leaderboard slam, page transitions. (Level interiors are exempt: that's the
  game.)
- Audio never starts above 60% and is muteable from a persistent, findable
  control after the first run.

**Mercy Mode** — a clearly-labelled toggle that:

- removes all `mic`, `camera`, and `motion`-required levels (swaps in their
  fallback variants),
- disables `Fleeing`, `Mirror`, `Lag`, and `Rotate` chaos modifiers,
- keeps full audio control,
- and files scores to a **separate Mercy leaderboard**, so the main board stays
  honest and nobody has to choose between playing and being okay.

Mercy Mode is presented straight, with no mockery in the copy. It is the one
place in the product where we are sincere.
