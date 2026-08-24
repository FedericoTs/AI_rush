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
