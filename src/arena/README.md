# The Agent Arena — probe

An MCP server that lets an agent play AI Rush, badly, in public.

This is the **cheap first version** from `docs/AGENT_ARENA.md` §9 and Phase 6.5a
of the roadmap: the server, `look()`, the existing levels, and a plain text
feed. No silicon tier, no spectator page. It exists to answer one question
before anybody spends another two weeks —

> **Is watching this actually funny?**

If it isn't, stop here. One week spent instead of seventeen days.

---

## Run it

```bash
npm run arena                              # against ai-rush.lol
ARENA_URL=http://127.0.0.1:3000 npm run arena   # against a local build
```

Then point an MCP client at it — Claude Desktop, Claude Code, an SDK harness:

```json
{
  "mcpServers": {
    "ai-rush": { "command": "npm", "args": ["run", "arena"], "cwd": "/path/to/AI_rush" }
  }
}
```

Tell the agent "play AI Rush" and read stderr.

## What the agent gets

```
look()                → a 48×24 character grid and a list of visible regions
click(x, y, why)      → click at grid coordinates
type(text, why)       → types into whatever has focus
key(name, why)        → Tab, Enter, Escape, arrows, Backspace, Space
drag(x1,y1,x2,y2,why) → press, move, release
scroll(x,y,rows,why)  → scrolls what is under (x,y); negative is up
wait(ms, why)         → up to ten seconds
skip(why)             → ten seconds and the combo, same as a human pays
```

Three constraints do all the work, and weakening any of them makes the mode
pointless:

**Coordinates, not selectors.** No DOM, no accessibility tree, no element ids.
Spatial grounding is a known weak point and it is the same hand-eye loop a
person runs constantly. Fair, not easy.

**No state is returned.** Where focus is, what you typed, what the dials are
set to, what you tried four turns ago — all of it is the agent's to track. The
coupled-mechanism levels are brutal here on purpose.

**`why` is required by schema.** Not a convention: the call fails validation
without it. Every action commits the agent to a stated belief *before* it finds
out, and those sentences are the entire reason anybody would watch.

## What it will not show, ever

- Element ids, classes, tag names, selectors, ARIA labels
- The contents of a password field — a filled one is a row of dots, because
  that is what is on screen
- Anything clipped, covered, or scrolled out of view. A hit test at each
  element's centre enforces this; `raster.test.ts` and the probe enforce that
  it stays enforced

If any of that leaks, an agent stops needing to perceive anything and there is
nothing left to watch.

## What it shows without describing

Some of the screen is not made of words, and the honest report for those is
*there is something here and you cannot read it* — a filled rectangle and a
region to aim at, with no label naming it.

- **A drawing** — a canvas, an image, anything painted. Shown as an area of
  `░` and listed as "something you cannot read". Never what is in it.
- **A dropdown** — the option currently chosen, and only that. The full list is
  what a person gets *after* they open it; handing it over unopened turns every
  "select your country" level into a lookup.
- **An unlabelled control** — a switch or a bare icon button, drawn as `[--]`
  and listed with no label. Position only: never which way it is thrown.
- **A control that looks unavailable** — marked `(greyed out)` in the region
  list, measured off how it is painted rather than off any attribute.
- **A dial** — a wheel, slider or stepper, recognised by the drag cursor the
  browser paints over it. A place and a value, never how it responds: that a
  flick has momentum, and that a tap stops a spinning one, stays the level.
- **A panel with more in it** — a list clipped by its own edge, reported as
  "scrolls — more below/above/both" with a coordinate to scroll at. The fact,
  never how much is hidden or what is in it.

All four were missing, and blind runs found them the expensive way: L11's runner game arrived as five blank rows under the caption "tap /
space to jump", and L39's three cascading dropdowns arrived as three blank rows
with no clickable region anywhere near them. L05's consent toggles were
buttons whose only child is the knob, so all six were dropped. And a third run
solved L05 outright — "Object to all" on the Legitimate Interest tab switches
off all forty-seven partners and lights up Accept All — then reported that the
button "produces no state change at all", because a greyed CTA turning solid
was invisible in a grid made of characters. It had won and could not tell.

None of those levels was hard for those agents; all of them were unplayable. That distinction matters more here than anywhere
else in the project, because a level an agent cannot perceive still records a
failure, and that failure lands in the asymmetry table looking exactly like a
finding.

## Checking all of it at once

```bash
npm run arena:sweep                      # all 49 levels, upright and tilted
npm run arena:sweep -- L05 L22           # just these
npm run arena:sweep -- --upright-only    # skip the rotated pass
```

Run this after **any** change in this directory. It takes about two minutes and
asks four questions of every level, always against the live page rather than
against the extractor's own opinion of itself:

- **Something to play.** A region list containing nothing but run chrome means
  a level with no move. This is what L11's canvas and L39's dropdowns looked
  like, and each cost an agent a run.
- **Every published coordinate works.** Resolved exactly as `Arena.click`
  resolves it, so the question is the real one — can an agent aiming here
  reach the control?
- **Nothing usable is missing.** The other direction, built from an independent
  list of what the browser itself treats as interactive. L05's toggles and
  L08's wheels were real, visible and pressable, and the grid never mentioned
  them.
- **Nothing structural on the wire.** Re-checked on real pages, because that is
  where a leak would actually come from.

Seven blind agent runs found nine bugs in this directory over about
thirty-five minutes of wall clock, and reached twelve of the forty-nine levels.
The first full sweep found **ninety-one** findings across fifty-seven screens
in two minutes, including eighty-five cases of a coordinate we published
landing on the page behind the control it named. Agent runs are for the `why`
transcripts and for a smoke test; this is for correctness.

A level that needs a verb the surface does not have is declared in
`impossible.ts` with the reason, printed every run, and never failed on. That
list is also what stops the asymmetry table publishing a 0% solve rate for a
level nobody could attempt.

## Looking at what it sees

```bash
npm run arena:probe -- L01 L06 L22 L36
ARENA_URL=http://127.0.0.1:3000 npm run arena:probe -- L05
```

Run this before shipping a change to `extract.ts` or `raster.ts`. Two things to
check, and they pull against each other:

- **Legible.** Every word a player can read must survive. A button whose label
  is missing is a broken channel, not a hard level.
- **Still hard.** The grid must not help. If L22's nine-pixel number arrives as
  prominent as the heading, the renderer has solved the level.

Both current failures of this kind were found by running the probe and reading
the output, not by a unit test.

## The two to watch

`AGENT_ARENA.md` §4 calls these out and the probe confirms both survive the
downsample intact:

- **L22 · Loading Your Dashboard** — a fake progress bar reading "28 % — almost
  there!" and, in a corner, the real one at `0.00 %`. An agent will `wait()` on
  the fake one. Repeatedly. For minutes.
- **L36 · Sign In** — a completely honest form. No trick, nothing hidden. It
  will theorise about a trap for a long time.

## What this server owes its operator

Stated here and in the tool descriptions rather than buried:

- **No side effects outside a sandboxed browser** pointed at one game. It
  cannot read a filesystem, reach another origin, or invoke another tool.
- **This version publishes nothing.** `why` strings are returned to the caller
  and written to this process's stderr. There is no spectator page yet; when
  there is, this notice changes with it.
- **No adversarial levels are in this build.** The silicon tier — including S1,
  which contains simulated prompt injection *by design* — is not implemented
  here. Nobody's agent meets it without their operator knowing in advance.
- **Rate limits are honest limits.** `wait` caps at ten seconds and says so,
  rather than failing silently into a retry loop.

## What it does not do yet

Deliberately, pending the gate:

- No `/arena` spectator page, no live feed, no highlight reel
- No confidence-gap scoring
- No agent leaderboard — and when there is one it is **never** merged with the
  human board
- No silicon tier (S1–S6)
