# Endgame, Share, and the X Loop

The 5 minutes are the product. The 30 seconds after are the growth engine.

## 1. The endgame sequence

Timing is deliberate — this is a cutscene, not a results screen.

```
0.0s   Clock hits 0:00. Everything freezes mid-interaction. Audio cuts to a
       single held tone. The level you were losing stays on screen, frozen,
       for 1.2 seconds. (You are made to look at what beat you.)

1.2s   The frozen level shatters / collapses. "TIME" stamps across it.

2.0s   TALLY. Score counts up on a slot-machine reel. It overshoots into
       absurdity (8,412,900) before snapping back to the truth (4,150).
       Per-line breakdown types itself out: levels solved, skipped, best
       combo, and CAUSE OF DEATH: "Enter Your Phone Number".

6.0s   HANDLE. "Claim your place." A text input for your @. It is, of course,
       slightly cursed — the @ is pre-typed and can't be deleted, and typing a
       second @ is silently swallowed. Mild. The player has suffered enough.
       Skippable: "post anonymously" files you as @anon_####.

       ── the leaderboard fetch happens here, in the background ──

9.0s   THE SLAM. See §2.

13.0s  SHARE. The card renders. Two buttons: "Post to X" (big, correct colour,
       correct side — the game breaks character for exactly one button) and
       "Play the same run" which copies the seed link.

       Below: "You think you can do worse? → Design a level" (the Lab).
```

## 2. The leaderboard slam

The single most important animation in the product.

1. The board renders **already scrolled to the bottom**, showing ranks far
   below the player's. The viewport is looking at the basement.
2. The player's row **rises from below the fold** — not fading in, physically
   translating up through the stack.
3. As it rises, rows it passes get **shoved aside** — each one kicks
   left/right with a spring, like being pushed through a crowd.
4. Speed ramps: fast through the low ranks, decelerating as it approaches its
   true position, with two false stops (it looks like it's settling, then
   surges up two more places).
5. It **slams** into position: screen shake, an impact frame, a rank stamp
   thunking down (`#4,102`), and dust particles.
6. The camera then pulls out to show the player's neighbourhood — 3 rows above,
   3 below, with handles. Seeing *specific people* one point ahead is what
   drives the replay.
7. If the player lands in the top 10: siren, obnoxious confetti, and the entire
   page hue-shifts once. If #1: the board goes gold and every other row bows
   (a 15° rotation, staggered).

**Implementation:** Framer Motion layout animations over a virtualized list.
The rank neighbourhood comes from `/api/board?around=@handle` so we render
real neighbours, not a fake stack. Respects `prefers-reduced-motion` by
cross-fading to the final state with the rank stamp only (per the honesty
clause — the chrome is always accessible).

## 3. The share card

Generated server-side at `/api/og` with Next.js `ImageResponse`. 1200×675.

Contents, in visual priority order:

- **The score**, enormous, in the slop gradient
- **`@handle` · RANK #4,102**
- **CAUSE OF DEATH: "Enter Your Phone Number"** — with the level's icon.
  This is the line that makes the post funny to people who haven't played.
- Solved / Skipped, as two counters
- Active chaos modifiers as badges (`COMIC SANS`, `MIRRORED`)
- The seed, small, bottom-right: `8F2A1C-M`
- A pixel-art rendering of the level that killed them, if it has one

Cards are **cached by `(runId)`** at the edge — a viral post generating 50k
image requests must hit cache, not Postgres.

### Card variants by percentile

The card's headline copy changes, which matters because 40 identical cards in a
timeline is noise and 40 *different* ones is a meme:

| Percentile | Headline |
| --- | --- |
| Top 1% | `SURVIVED THE INTERFACE` |
| Top 10% | `DANGEROUSLY COMPETENT` |
| 25–75% | `AVERAGE HUMAN. ADEQUATE.` |
| Bottom 25% | `THE INTERFACE WON` |
| 0 levels solved | `DID NOT SURVIVE THE COOKIE BANNER` |

## 4. The post text

Randomized from a bank, seeded by run id so re-sharing gives the same text.
All variants contain: a number, a named level, and a challenge.

```
I survived 7 of 12 AI-generated interfaces in 5 minutes.
Killed by "Enter Your Phone Number" (it's ten sliders).
Rank #4,102. Beat my exact run ↓
airush.app/r/8F2A1C-M

──────

Spent 40 seconds tilting my laptop at a form. Score: 4,150.
"Please Stand Up" is a real level and it means it.
airush.app/r/8F2A1C-M

──────

The password field made me play an endless runner to collect the letters.
I collected six of seven. Rank #4,102.
airush.app/r/8F2A1C-M

──────

I scored 0. I did not get past the cookie banner.
There were 47 toggles. Three of them fight each other.
airush.app/r/8F2A1C-M
```

Copy rules: never use the word "addictive", never use 🔥, never more than one
emoji. The text must read like a person posting, not a growth team. Slop is the
game's aesthetic, not its marketing voice.

## 5. Seeded challenge links — the actual growth loop

`airush.app/r/8F2A1C-M` is the mechanic that makes this spread.

- Opening it loads **the identical run**: same levels, same order, same
  modifiers, same RNG, same par times.
- The friend plays against a **ghost**: a thin bar at the top showing where the
  sharer was at this point in their run (`@fed was on level 6 with 2,400`).
  Passing the ghost triggers an obnoxious overtake sound.
- The endgame for a seeded run adds a head-to-head card: *"You beat @fed by
  310"* — which is a **better** share asset than the original, because now
  there are two handles in it and X's reply chains do the rest.
- Capability suffix (`-M`, `-MA`, `-MAC`) means a desktop player opening a
  phone player's link gets the same run with degraded-path variants — a fair
  comparison rather than a broken one. See `ARCHITECTURE.md` §5.

**The loop:** play → get a specific, funny, personal result → post it with a
link that lets your friends get *their* specific funny result on *your* run →
they post the head-to-head. Each hop produces a new artifact rather than a
retweet.

## 6. What we are deliberately not building

- No daily streaks, energy, currency, or push-notification retention nags.
- No "invite 3 friends to unlock" gating.
- No account wall before the share.
- No leaderboard reset seasons at launch. (Reconsider at 100k runs — an
  all-time board that nobody can crack becomes decorative, and a monthly board
  is the standard fix. Not a launch problem.)

The game is a joke with a leaderboard. Every retention system we bolt on makes
it less shareable, because it makes it a product people are being farmed by
rather than a thing that happened to them.
