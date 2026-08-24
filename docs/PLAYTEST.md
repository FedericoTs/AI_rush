# The Phase 2 playtest

`ROADMAP.md` calls this "the real gate on the whole project", and it is the one
thing in this repository that cannot be built, tested or automated. Five people
have to sit down and play. This document is everything around that, so the
evening it happens costs twenty minutes of setup instead of a weekend.

**The gate:** somebody who isn't us plays a full five minutes and laughs out
loud at least twice.

**The failure mode is not difficulty. It is confused silence.** A player
swearing at L11 is the game working. A player quietly re-reading L24 for eleven
seconds with no expression is the game broken, and it will not show up in any
metric we have — which is why a human watches, and why the observer bar has a
button for it.

---

## Before anyone arrives

- [ ] Deploy is green and `/play` opens on the device they will hold.
- [ ] Decide the device per person and write it down. A phone player and a
      desktop player are two different tests and the report will not tell them
      apart on its own.
- [ ] Screen recording set up **with audio**. The audio *is* the measurement.
- [ ] Open the run as `/play?observe=1`. Check the green bar is at the bottom.
- [ ] Have `docs/PLAYTEST.md` open at the tally sheet below. You will not
      remember which participant number you are on.

Five people is the number. Four tells you nothing you didn't already suspect;
six does not tell you more than five.

## Recruiting

The only requirement is that **they have never seen it**. Not a designer, not
somebody who has heard you talk about it, not somebody who will be nice to you.
A friend's flatmate is the ideal participant.

Two of the five should be people who would not describe themselves as gamers.
This game is a joke about forms, and the people who fill in the most forms are
not the people who play the most games.

## The script

Say exactly this and then stop talking:

> "This is a five-minute game. I'm going to record the screen and the sound.
> Play it however you want — I'm not going to help, and there's nothing you can
> get wrong. Talk out loud if you feel like it."

Then say nothing at all until the clock runs out. Not "you can skip that one",
not a laugh at the right moment, not a hint. **Every word you say invalidates
the session**, because the thing being tested is whether the game explains
itself, and you are not shipping with them.

If they ask a direct question, answer with "whatever you think" and nothing
more.

### While they play

Your only job is four buttons.

| Press | When |
| --- | --- |
| **⌥1 · Laugh** | An actual laugh, snort or "oh my god". Not a smile. |
| **⌥2 · Confused** | Silence, re-reading, a stall with no attempt. The important one. |
| **⌥3 · Rage** | Annoyed at the *game* rather than at the joke. These are different sounds and you will hear the difference. |
| **⌥4 · Mark** | Anything else worth scrubbing back to. |

They are also tap targets, for when you are next to a phone rather than a
keyboard. Hold Alt on a laptop; bare digits get typed into half the levels.

Marks are timestamped against the run's own clock, so a laugh at 2:14 lands
next to whatever they were doing at 2:14. Press early and often — a mark you
regret costs nothing, a mark you didn't take is gone.

### Afterwards

Two questions, in this order, before you say anything else:

1. **"What was that?"** — you are listening for whether the premise landed
   without being explained. If they say "it's a game about bad websites", the
   front page works.
2. **"Which one was the worst?"** — then ask why. The answer separates *worst*
   meaning funniest from *worst* meaning broken, and it is the only place that
   distinction is recorded.

Then type who they were into the tally screen — `P3 · iPhone 13 · never seen
it` — and hit **Save session file**. Drop it in the folder next to the
recording. Nothing is uploaded; the file is on your disk and nowhere else.

## Reading the result

```
npm run playtest:report -- ./playtests
```

It prints the gate per person, then a row per level: how often it was reached,
skip rate, median solve, current par and a proposed one, and the laugh and
confusion counts. Then it names what to do about it.

| Flag | Means |
| --- | --- |
| `CUT?` | Over 60% skipped, nobody laughed. Nobody is engaging with it. |
| `FIX` | Over 60% skipped **but people laughed** — the joke lands and the mechanic doesn't. Rewrite it; do not throw it away. |
| `FREE` | Median under 5 seconds. It's a point handout, not a level. |
| `WATCH` | More confusion than laughs. Confused silence is the failure mode. |
| `KEEP` | Two or more laughs. Leave it alone. |

The proposed par is the **median of clean first-try solves** — not of all
solves, which is dragged upward by people who failed twice first. It needs
three clean solves before it will propose anything, and it says `—` rather than
inventing a number off one lucky run.

Par changes of two seconds or more are listed separately. Apply them to
`meta.parSeconds` and rerun the unit suite; scoring is pure and the tests will
catch a par that makes a tier incoherent.

## The decision

`ROADMAP.md` is blunt about this and it is right:

> If Phase 2 doesn't produce laughs, **stop and fix the levels.** Do not build
> a leaderboard for a game nobody enjoys.

The leaderboard is already built, so the honest version for where this project
actually is: **if the gate fails, the next commit is a level rewrite, not a
feature.** The report's `CUT?` and `FIX` rows are the list.

---

## Tally sheet

Print or copy. The session file records everything except the two answers.

```
P1 ─ device ______________  never seen it? Y / N
     "What was that?"      _______________________________________________
     "Which was worst?"    _______________________________________________
     worst = funniest / broken   (circle one)

P2 ─ device ______________  never seen it? Y / N
     "What was that?"      _______________________________________________
     "Which was worst?"    _______________________________________________
     worst = funniest / broken   (circle one)

P3 ─ device ______________  never seen it? Y / N
     "What was that?"      _______________________________________________
     "Which was worst?"    _______________________________________________
     worst = funniest / broken   (circle one)

P4 ─ device ______________  never seen it? Y / N
     "What was that?"      _______________________________________________
     "Which was worst?"    _______________________________________________
     worst = funniest / broken   (circle one)

P5 ─ device ______________  never seen it? Y / N
     "What was that?"      _______________________________________________
     "Which was worst?"    _______________________________________________
     worst = funniest / broken   (circle one)
```

## What the observer bar is not

It is not analytics. It is never sent anywhere, it exists only when `observe=1`
is in the URL, and it cannot affect a run: the clock does not pause for it, no
mark enters the event log, and a watched run scores identically to an unwatched
one. It is a stopwatch somebody is holding near the game.

The session file contains a run's event log, the deck it was dealt, and the
marks — no video, no audio, no identifiers beyond the line you typed yourself.
Keep it with the recording and delete both when you're done with them.
