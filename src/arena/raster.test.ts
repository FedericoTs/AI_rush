import { describe, expect, it } from "vitest";
import { COLS, ROWS, rasterize, render, type Box, type Viewport } from "./raster";

/**
 * The rasterizer is the one piece of the Arena with real technical risk
 * (`AGENT_ARENA.md` §9), and its correctness is not "does it look right" — it
 * is a set of properties about what an agent is and is not allowed to perceive.
 *
 * Those properties are what these test. Most importantly: the grid is the
 * *whole* channel. Anything that leaks structure through it — a selector, an
 * id, a tag name, the true contents of a password field — hands the agent the
 * source code and there is nothing left to watch.
 */

const VIEW: Viewport = { width: 480, height: 720 };

/* One grid cell at this viewport, so tests can talk in cells. */
const CW = VIEW.width / COLS;
const CH = VIEW.height / ROWS;
const at = (cx: number, cy: number, cells = 8): Pick<Box, "x" | "y" | "w" | "h"> => ({
  x: cx * CW,
  y: cy * CH,
  w: cells * CW,
  h: CH,
});

describe("the grid", () => {
  it("is always exactly 48×24, whatever it was given", () => {
    for (const boxes of [[], [{ text: "hi", ...at(0, 0), kind: "text" as const }]]) {
      const look = rasterize(boxes, VIEW);
      expect(look.grid).toHaveLength(ROWS);
      for (const line of look.grid) expect(line).toHaveLength(COLS);
    }
  });

  it("puts text where it is on screen, not where it is in the document", () => {
    /* Second in the list, first on screen. A DOM order readout would get this
       backwards, and getting it backwards is how an agent solves a level about
       visual arrangement without ever looking at one. */
    const look = rasterize(
      [
        { text: "BOTTOM", ...at(2, 20), kind: "text" },
        { text: "TOP", ...at(2, 1), kind: "text" },
      ],
      VIEW,
    );

    expect(look.grid[1]).toContain("TOP");
    expect(look.grid[20]).toContain("BOTTOM");
  });

  it("runs a long text into empty space rather than stopping at its own edge", () => {
    const look = rasterize(
      [{ text: "a sentence far too long for its box", ...at(0, 0, 6), kind: "text" }],
      VIEW,
    );
    /* Nothing else is on this row, so nothing is served by cutting it short. */
    expect(look.grid[0]!.trimEnd()).toBe("a sentence far too long for its box");
  });

  it("stops at the first thing already on the row, and says it stopped", () => {
    const look = rasterize(
      [
        { text: "an unreasonably long paragraph of boilerplate", ...at(0, 0, 6), kind: "text" },
        { text: "OK", ...at(10, 0, 4), kind: "button" },
      ],
      VIEW,
    );

    const row = look.grid[0]!;
    /* The button survives; the paragraph admits it was cut off. */
    expect(row.slice(10, 12)).toBe("OK");
    expect(row.slice(0, 10)).toBe("an unreas…");
  });

  /*
   * The bug a failing test found.
   *
   * L22's mechanic is a nine-pixel number — one grid cell — and clipping to
   * the box width turns "99%" into "9". A person can read nine-pixel text; it
   * is small, not illegible. What this downsample is allowed to lose is
   * prominence, never legibility, or it defeats the level instead of
   * representing it.
   */
  it("keeps a nine-pixel number readable, and no more prominent than it is", () => {
    const look = rasterize(
      [
        { text: "Loading your dashboard…", ...at(0, 4, 30), kind: "heading" },
        { text: "99%", x: 12, y: 200, w: 9, h: 9, kind: "text" },
      ],
      VIEW,
    );

    const screen = look.grid.join("\n");
    expect(screen).toContain("99%");
    /* Still just three characters in a corner of a busy screen — findable,
       and exactly as easy to walk past as it is in the level. */
    expect(look.regions.some((r) => r.label.includes("99%"))).toBe(false);
  });
});

describe("what is on top", () => {
  it("lets a higher z paint over a lower one", () => {
    const look = rasterize(
      [
        { text: "UNDERNEATH", ...at(0, 5), kind: "text", z: 0 },
        { text: "OVER", ...at(0, 5), kind: "text", z: 10 },
      ],
      VIEW,
    );
    expect(look.grid[5]!.startsWith("OVER")).toBe(true);
    expect(look.grid[5]).not.toContain("UNDERNEATH");
  });

  it("hides a form behind an opaque dialog, the way a screen does", () => {
    const look = rasterize(
      [
        { text: "Email address", ...at(1, 8, 20), kind: "field" },
        { text: "Password", ...at(1, 10, 20), kind: "field" },
        {
          text: "Are you sure?",
          x: 0,
          y: 7 * CH,
          w: VIEW.width,
          h: 6 * CH,
          kind: "heading",
          z: 5,
          opaque: true,
        },
      ],
      VIEW,
    );

    const screen = look.grid.join("\n");
    expect(screen).toContain("Are you sure?");
    /* Both fields are underneath it. An agent told they were visible would
       type into them, and it would be our bug rather than its mistake. */
    expect(screen).not.toContain("Email address");
    expect(screen).not.toContain("Password");
  });

  it("breaks a tie by document order, which is what sits on top by default", () => {
    const look = rasterize(
      [
        { text: "FIRST", ...at(0, 3), kind: "text" },
        { text: "LATER", ...at(0, 3), kind: "text" },
      ],
      VIEW,
    );
    expect(look.grid[3]!.startsWith("LATER")).toBe(true);
  });
});

describe("regions", () => {
  it("names only what a person would call a control, in reading order", () => {
    const look = rasterize(
      [
        { text: "Continue", ...at(20, 12, 10), kind: "button" },
        { text: "Some paragraph of copy", ...at(1, 2, 20), kind: "text" },
        { text: "Cancel", ...at(2, 12, 10), kind: "button" },
      ],
      VIEW,
    );

    expect(look.regions.map((r) => r.label)).toEqual(["Cancel", "Continue"]);
    expect(look.regions.every((r) => r.kind !== "text")).toBe(true);
  });

  it("gives a control at least one cell to aim at, however thin it is", () => {
    /* Rounded outward on purpose: a control rounded *in* to nothing is one the
       agent can see and cannot press, which is not a joke, it is a hang. */
    const look = rasterize([{ text: "x", x: 3, y: 3, w: 2, h: 2, kind: "button" }], VIEW);
    expect(look.regions).toHaveLength(1);
    expect(look.regions[0]!.w).toBeGreaterThanOrEqual(1);
    expect(look.regions[0]!.h).toBeGreaterThanOrEqual(1);
  });

  it("does not report an invisible backdrop as something to click", () => {
    const look = rasterize(
      [{ text: "", x: 0, y: 0, w: VIEW.width, h: VIEW.height, kind: "button", opaque: true }],
      VIEW,
    );
    expect(look.regions).toHaveLength(0);
  });
});

describe("the rendered view", () => {
  it("carries a ruler, because counting spaces is not the game", () => {
    const out = render(rasterize([{ text: "Continue", ...at(30, 6), kind: "button" }], VIEW));

    /* Column markers so an agent can read off a coordinate rather than
       arithmetic its way to one. Spatial grounding is meant to be hard; the
       game is not meant to be unfair about counting. */
    expect(out).toContain("0123456789");
    expect(out).toContain("Continue");
    expect(out).toContain("(30,6) button");
  });

  it("says so plainly when there is nothing to click", () => {
    expect(render(rasterize([], VIEW))).toContain("(none)");
  });
});

/**
 * The constraint the whole mode rests on.
 *
 * If any of this ever leaks through, the Arena is pointless — an agent that
 * can read a selector does not have to look at anything.
 */
describe("what never reaches the agent", () => {
  it("emits nothing but text, coordinates and a visual kind", () => {
    const look = rasterize(
      [{ text: "Sign in", ...at(4, 4, 10), kind: "button" }],
      VIEW,
    );

    const serialised = JSON.stringify(look);
    for (const leak of ["id=", "class", "querySelector", "aria-", "<button", "data-", "input"]) {
      expect(serialised, `must not contain ${leak}`).not.toContain(leak);
    }
    expect(Object.keys(look.regions[0]!).sort()).toEqual(["h", "kind", "label", "w", "x", "y"]);
  });
});

/**
 * Things on the screen that are not made of words.
 *
 * A blind run of the whole game found this one: L11's runner game is a canvas,
 * a canvas has no text, and it was therefore dropped before it reached the
 * grid. The agent got five blank rows under the caption "tap / space to jump",
 * spent four turns pressing space at nothing, and skipped — recorded as a
 * level an agent could not solve, when what actually happened is that we told
 * it there was nothing there.
 *
 * The level is *meant* to be near-impossible for an agent (§4: "the flailing
 * is the show"). Flailing at an interface you can see is the joke. Being
 * unable to see it is our bug, and it is the kind that would have quietly
 * filled the asymmetry table with failures that were never the agent's.
 */
describe("a drawing", () => {
  const canvas: Box = { text: "", ...at(2, 8, 40), h: 5 * (720 / ROWS), kind: "drawing" };

  it("occupies its area so the agent can see something is there", () => {
    const look = rasterize([canvas], VIEW);
    expect(look.grid[8]).toContain("░");
    expect(look.grid[12]).toContain("░");
    /* And nowhere it is not. */
    expect(look.grid[7]!.trim()).toBe("");
    expect(look.grid[13]!.trim()).toBe("");
  });

  it("is listed as a region, so there is somewhere to aim", () => {
    const region = rasterize([canvas], VIEW).regions.find((r) => r.kind === "drawing");
    expect(region).toBeTruthy();
    expect(region!.y).toBe(8);
  });

  it("says nothing whatsoever about what is drawn in it", () => {
    /* The whole value of the fix depends on this. A label naming the thing —
       "canvas", "image", "a dinosaur" — would hand over exactly the perception
       the agent is supposed to be failing at. */
    const look = rasterize([canvas], VIEW);
    const serialised = JSON.stringify(look);
    for (const leak of ["canvas", "image", "img", "svg", "video", "picture"]) {
      expect(serialised.toLowerCase(), `must not contain ${leak}`).not.toContain(leak);
    }
  });

  it("never paints over a caption drawn on top of it", () => {
    /* L11's "tap / space to jump" sits over the playfield. Painting top-most
       first means the caption claims its cells and the fill goes around it —
       losing the one instruction the level gives would turn a hard level into
       an unexplained one. */
    const look = rasterize(
      [canvas, { text: "tap / space to jump", ...at(2, 12, 20), kind: "text" }],
      VIEW,
    );
    expect(look.grid[12]).toContain("tap / space to jump");
    expect(look.grid[12]).toContain("░");
  });
});

/**
 * The invariant that makes a region list mean anything.
 *
 * Every coordinate the grid advertises gets turned back into a pixel by
 * `Arena.toPixels`, which takes the *centre* of that cell. So a cell whose
 * centre falls outside the box is not a near miss — it is a coordinate we
 * published and the mouse then lands somewhere else entirely.
 *
 * A blind run found this by losing to it for four minutes: L27's address input
 * spans y 239–284, its top edge sat one pixel inside the row spanning 210–240,
 * and the old outward rounding advertised that row. Its centre is 225px. Every
 * click missed the field, focus never moved, and the agent reasonably concluded
 * that typing was broken in this game. Any control whose top edge fell in the
 * lower half of a row was unclickable — a coin flip per field, on every text
 * level in the catalogue.
 */
describe("every advertised coordinate is one you can actually click", () => {
  /* What the harness does with a grid coordinate. Duplicated from
     `Arena.toPixels` on purpose: if that mapping ever changes, this test
     should fail rather than quietly keep passing against a stale copy. */
  const toPixels = (cx: number, cy: number) => ({
    px: Math.round((cx + 0.5) * (VIEW.width / COLS)),
    py: Math.round((cy + 0.5) * (VIEW.height / ROWS)),
  });

  it("holds for a field at every vertical offset within a row", () => {
    /* The real L27 geometry, walked across a whole row. The failing case was
       an offset of 29 out of 30, which is exactly the kind of number nobody
       picks by hand. */
    for (let offset = 0; offset < 30; offset++) {
      const box: Box = {
        text: "",
        x: 35, y: 210 + offset, w: 300, h: 45,
        kind: "field",
      };
      const region = rasterize([box], VIEW).regions[0]!;
      const { px, py } = toPixels(region.x, region.y);

      expect(py, `offset ${offset}: click above the box`).toBeGreaterThanOrEqual(box.y);
      expect(py, `offset ${offset}: click below the box`).toBeLessThanOrEqual(box.y + box.h);
      expect(px, `offset ${offset}: click left of the box`).toBeGreaterThanOrEqual(box.x);
      expect(px, `offset ${offset}: click right of the box`).toBeLessThanOrEqual(box.x + box.w);
    }
  });

  it("still places text too small to hold a cell centre", () => {
    /* L22's nine-pixel number is the whole level. A rule that only kept cells
       whose centres a box contains would drop it entirely, which is why the
       fallback exists. */
    const tiny: Box = { text: "0.00 %", x: 411, y: 268, w: 36, h: 9, kind: "text" };
    const look = rasterize([tiny], VIEW);
    expect(look.grid.join("\n")).toContain("0.00 %");
  });
});

/**
 * Controls with no words on them.
 *
 * Two blind runs died on L05 the same way. Its six consent toggles are buttons
 * whose only child is the knob, so the own-text walk returned nothing and every
 * one of them was dropped — leaving six category names with no switch anywhere
 * near them. The second agent guessed the truth and could not act on it:
 *
 *   turn 6 · "Guessing the six category rows have toggle switches drawn off to
 *   the right past the visible text"
 *
 * They were exactly there. Not a hard level — a level with no legal move.
 */
describe("an unlabelled control", () => {
  const toggle: Box = { text: "", x: 406, y: 216, w: 34, h: 19, kind: "button" };

  it("is drawn as something you can press", () => {
    const look = rasterize([toggle], VIEW);
    expect(look.grid.join("\n")).toMatch(/\[-*\]/);
  });

  it("is listed as a region, so there is somewhere to aim", () => {
    expect(rasterize([toggle], VIEW).regions).toHaveLength(1);
  });

  it("says nothing about which way the switch is thrown", () => {
    /* That is state. It is legible on screen, and inferring it from a knob's
       offset would be reading the DOM on the agent's behalf. L05 prints
       "46 of 47 partners enabled" in plain text; finding the odd one out is
       the level. */
    const serialised = JSON.stringify(rasterize([toggle], VIEW));
    for (const leak of ["true", "false", "checked", "on", "off"]) {
      expect(serialised.toLowerCase()).not.toContain(`"${leak}"`);
    }
  });

  it("does not swallow a backdrop, which is not a control at all", () => {
    /* A modal backdrop is also a textless clickable rectangle. Announcing it
       would have the agent clicking the dark area behind a dialog because we
       called it a button. */
    const backdrop: Box = {
      text: "", x: 0, y: 0, w: VIEW.width, h: VIEW.height, kind: "button", opaque: true,
    };
    expect(rasterize([backdrop], VIEW).regions).toHaveLength(0);
  });
});

/**
 * A control that looks unavailable.
 *
 * The third blind run lost L05 to the absence of this, and lost it *after
 * solving it*. The level's honest exit is the Legitimate Interest tab, whose
 * "Object to all" switches off all forty-seven partners and lights up Accept
 * All. The agent found the tab, pressed the button, got back a screen with
 * identical characters on it, and concluded:
 *
 *   "Object to all on the Legitimate Interest pane produces no state change
 *   at all"
 *
 * It had won and could not see that it had. A greyed button turning solid is
 * the most common state change in this catalogue, and the grid said nothing
 * about any of it — which made the agent strictly worse off than a person for
 * no design reason at all.
 */
describe("a control drawn faded", () => {
  const cta = (dim: boolean): Box => ({
    text: "Accept All", x: 240, y: 420, w: 200, h: 44, kind: "button", ...(dim ? { dim: true } : {}),
  });

  it("is marked when it looks greyed out, and not when it does not", () => {
    expect(rasterize([cta(true)], VIEW).regions[0]!.dim).toBe(true);
    expect(rasterize([cta(false)], VIEW).regions[0]!.dim).toBeUndefined();
  });

  it("says so where the agent is reading, not just in the data", () => {
    expect(render(rasterize([cta(true)], VIEW))).toContain("(greyed out)");
    expect(render(rasterize([cta(false)], VIEW))).not.toContain("(greyed out)");
  });

  it("keeps its words, because a greyed button is still readable", () => {
    /* Fading is not hiding. A person reads the label on a disabled button
       perfectly well, and the whole reason to press it is knowing what it
       claims to do. */
    expect(rasterize([cta(true)], VIEW).grid.join("\n")).toContain("Accept All");
  });
});
