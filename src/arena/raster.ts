/**
 * The screen, the way a person sees it.
 *
 * This is the whole Agent Arena in one function, and `AGENT_ARENA.md` §3 is
 * blunt about why:
 *
 *   > if the agent can read the DOM, it wins instantly and there is nothing to
 *   > watch. A password field is trivial when you can `querySelector('input')`
 *   > and see `value` — the entire game is about *perceiving* an interface,
 *   > and handing over the source code skips the game.
 *
 * So the agent gets a 48×24 character grid. No DOM, no accessibility tree, no
 * selectors, no element ids, no tag names. Text lands where it appears on
 * screen, at the resolution a squint would give you, and everything that is
 * only *structure* — the thing that makes automation easy and perception
 * unnecessary — is thrown away before it gets here.
 *
 * ── Why the rasterizer is pure ───────────────────────────────────────────
 *
 * `AGENT_ARENA.md` §9 calls this "the only piece with real technical risk", so
 * the risky half is separated from the browser entirely. Extraction — walking
 * the page for visible text and its rectangles — runs inside the page and is
 * dumb. Everything that decides what the agent actually perceives is here, in
 * a pure function over plain data, and is tested against hand-written layouts
 * rather than against a live browser.
 *
 * ── Why lossy is the point ───────────────────────────────────────────────
 *
 * Two boxes that collide in the grid genuinely overlap on screen, and a human
 * would have the same trouble. Text that is 4px tall gets one row like
 * everything else, so L22's nine-pixel number is *there* and easy to miss —
 * which is exactly the level's mechanic, preserved rather than defeated.
 */

export const COLS = 48;
export const ROWS = 24;

/** One run of text with the box it occupied, in CSS pixels. */
export interface Box {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * What it looked like, never what it was. "button" is a thing with a border
   * that responds to a click; the agent is not told the tag name, and a `div`
   * dressed as a button is reported as a button because that is what a person
   * would call it.
   */
  kind: "text" | "button" | "field" | "heading";
  /** Painted on top of what it overlaps. Higher wins a collision. */
  z?: number;
  /**
   * The box has a solid background, so it hides what is behind it.
   *
   * Without this a modal would only obscure the exact characters it happens to
   * land on, and the form underneath would read as still available — which is
   * the one thing a screen never does. An agent typing into a field a dialog
   * is covering is a good joke; an agent doing it because we told it the field
   * was visible is a bug.
   */
  opaque?: boolean;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Region {
  /** Grid coordinates, inclusive. Where to aim a click. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: Box["kind"];
  /** Trimmed to something a line of reasoning can refer to. */
  label: string;
}

export interface Look {
  /** ROWS lines of exactly COLS characters. */
  grid: string[];
  /** The things a person would say are on screen, top to bottom. */
  regions: Region[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Where a pixel rectangle lands on the grid.
 *
 * Rounded outward — a box that covers any part of a cell owns that cell —
 * because the agent clicks at grid coordinates, and a control rounded *in* to
 * nothing is a control it can see and cannot press.
 */
function toCells(box: Box, view: Viewport) {
  const cw = view.width / COLS;
  const ch = view.height / ROWS;

  const x0 = clamp(Math.floor(box.x / cw), 0, COLS - 1);
  const y0 = clamp(Math.floor(box.y / ch), 0, ROWS - 1);
  const x1 = clamp(Math.ceil((box.x + box.w) / cw) - 1, x0, COLS - 1);
  const y1 = clamp(Math.ceil((box.y + box.h) / ch) - 1, y0, ROWS - 1);

  return { x0, y0, x1, y1 };
}

/**
 * Draw one box's text into the grid.
 *
 * Text starts on the box's **first** row at its left edge, and then two rules
 * decide how far it gets:
 *
 * 1. **Inside its own cells it always wins.** The caller sorted by z, so this
 *    box is on top of anything already there.
 * 2. **Past its own cells it only fills blanks.** It stops at the first cell
 *    something else has claimed.
 *
 * The second rule is the one that took a failing test to find. Clipping
 * strictly to the box width sounds right and quietly destroys levels: L22's
 * mechanic is a nine-pixel number, which is one grid cell, and "99%" clipped to
 * one cell is `9`. A person can read nine-pixel text — it is small, not
 * illegible — so what the downsample is allowed to lose is *prominence*, never
 * legibility. Overflowing into empty space keeps the number readable while
 * leaving it exactly as easy to overlook as it is on screen.
 *
 * And it still protects the other case: a paragraph of boilerplate runs until
 * it reaches a button and then stops, instead of smearing over it.
 */
function paint(rows: string[][], claimed: boolean[][], box: Box, view: Viewport): void {
  const { x0, y0, x1, y1 } = toCells(box, view);
  if (x1 < x0) return;

  /*
   * An empty field is still a rectangle.
   *
   * A person looking at a sign-in form sees a labelled box waiting for a
   * password. Reporting nothing there — which is what happened until a probe
   * of L36 showed the field simply missing — leaves an agent able to read the
   * word "Password" with nowhere to click, which is not difficulty, it is a
   * broken channel. Underscores are the character-cell way to draw a field and
   * are instantly legible.
   */
  const text =
    box.kind === "field" && !box.text.trim()
      ? "_".repeat(Math.max(1, x1 - x0 + 1))
      : box.text.replace(/\s+/g, " ").trim();

  if (text) {
    const row = rows[y0]!;
    const mark = claimed[y0]!;
    for (let i = 0; i < text.length; i++) {
      const col = x0 + i;
      if (col >= COLS) break;
      if (mark[col]) {
        /* Something above got here first. Say the text was cut rather than let
           it look complete — an agent acting on half a sentence it believes is
           whole is a bug, not a joke. */
        if (i > 0) row[col - 1] = "…";
        break;
      }
      row[col] = text[i]!;
      mark[col] = true;
    }
  }

  /* A background is what hides the form behind a dialog. Claimed *after* its
     own text, so an opaque box never erases itself. */
  if (box.opaque) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) claimed[y]![x] = true;
    }
  }
}

/**
 * The screen as characters, plus the regions worth naming.
 *
 * Painted **top-most first**, which is the opposite of the obvious order and
 * the only one that works. Painting bottom-up lets a paragraph write straight
 * across the row and a button then stamp two characters into the middle of it,
 * leaving the agent a sentence with a word wedged inside it. Going the other
 * way, whatever is on top writes freely, claims its cells, and everything
 * underneath fills in around it and stops when it runs into something — which
 * is what looking at a screen is actually like.
 *
 * A modal painted over a form therefore hides the form, exactly as it does on
 * a screen. An agent that keeps trying to type into a field it cannot see is
 * precisely the show; an agent doing it because we said the field was visible
 * would be our bug.
 */
export function rasterize(boxes: readonly Box[], view: Viewport): Look {
  const rows: string[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => " "));
  const claimed: boolean[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => false),
  );

  const ordered = boxes
    .map((box, i) => ({ box, i }))
    /* Two things with no text still matter: an opaque panel, which hides what
       is behind it, and an empty field, which is a rectangle somebody can see
       and click. Everything else with nothing to say is layout, and the agent
       never hears of it. */
    .filter(
      ({ box }) =>
        box.w > 0 &&
        box.h > 0 &&
        (box.text.trim().length > 0 || box.opaque === true || box.kind === "field"),
    )
    /* Descending: higher z first, and within one z the later element, because
       later in the document is what sits on top when nothing says otherwise. */
    .sort((a, b) => (b.box.z ?? 0) - (a.box.z ?? 0) || b.i - a.i);

  for (const { box } of ordered) paint(rows, claimed, box, view);

  /* Reading order for the human-facing list, whatever order they were painted
     in — an agent scanning for a button should find them the way a person
     would, down the screen and then across it. */
  const regions: Region[] = ordered
    .filter(({ box }) => box.kind !== "text" && (box.text.trim().length > 0 || box.kind === "field"))
    .map(({ box }) => {
      const { x0, y0, x1, y1 } = toCells(box, view);
      return {
        x: x0,
        y: y0,
        w: x1 - x0 + 1,
        h: y1 - y0 + 1,
        kind: box.kind,
        label: box.text.replace(/\s+/g, " ").trim().slice(0, 40) || "(empty)",
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);

  return { grid: rows.map((r) => r.join("")), regions };
}

/**
 * What actually goes back to the agent.
 *
 * A framed grid, because an agent that has to count spaces to find column 31
 * will not, and a ruler is the difference between "spatial grounding is hard"
 * and "spatial grounding is a trick question". The game is meant to be unfair
 * about interfaces, not about arithmetic.
 */
export function render(look: Look): string {
  const tens = Array.from({ length: COLS }, (_, i) => (i % 10 === 0 ? String((i / 10) % 10) : " ")).join("");
  const ones = Array.from({ length: COLS }, (_, i) => String(i % 10)).join("");

  const body = look.grid.map((line, y) => `${String(y).padStart(2, " ")}│${line}│`).join("\n");

  const regions = look.regions.length
    ? look.regions
        .map((r) => `  (${r.x},${r.y}) ${r.kind.padEnd(7)} ${r.label}`)
        .join("\n")
    : "  (none)";

  return [
    `   ${tens}`,
    `   ${ones}`,
    `  ┌${"─".repeat(COLS)}┐`,
    body,
    `  └${"─".repeat(COLS)}┘`,
    "",
    "Distinct regions (click at any coordinate inside one):",
    regions,
  ].join("\n");
}
