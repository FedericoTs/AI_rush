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
  kind: "text" | "button" | "field" | "heading" | "drawing";
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
 * The invariant, and it is the whole reason this function is not two lines of
 * `Math.floor`: **a cell this returns must be a cell you can click.** The
 * agent is handed grid coordinates and the harness turns each one back into
 * the pixel at that cell's *centre*, so a cell whose centre falls outside the
 * box is a coordinate we advertised and the mouse then misses.
 *
 * Rounding outward gets that wrong, and a blind run found it the expensive
 * way. L27's address input spans y 239–284; its top edge sits one pixel inside
 * the row that spans 210–240, so the old `floor` advertised row 7 — whose
 * centre is 225px, fourteen pixels above the field. Every click landed on the
 * page body, focus never moved, and the agent spent four minutes concluding
 * that typing was broken in this game:
 *
 *   turn 51 · "type has never worked once this whole run, so I suspect clicks
 *   are not actually setting keyboard focus"
 *
 * It was right, and it was our fault. Any control whose top edge happened to
 * fall in the lower half of a row was unclickable, which is a coin flip per
 * field on every text level in the catalogue.
 *
 * So a box owns the cells whose centres it actually contains. The fallback
 * matters as much as the rule: something thinner than a cell that straddles a
 * boundary contains no centre at all, and the honest answer for it is the cell
 * holding its own middle. That is what keeps L22's nine-pixel number — one
 * cell, and the entire mechanic of the level — on the grid at all.
 */
function toCells(box: Box, view: Viewport) {
  const span = (start: number, size: number, cell: number, max: number) => {
    let a = Math.ceil(start / cell - 0.5);
    let b = Math.floor((start + size) / cell - 0.5);
    /* No cell centre inside it: too small to contain one. Use the cell its own
       centre lands in, which is where a person would point at it. */
    if (b < a) a = b = Math.floor((start + size / 2) / cell);
    a = clamp(a, 0, max);
    b = clamp(b, 0, max);
    return { lo: a, hi: Math.max(a, b) };
  };

  const x = span(box.x, box.w, view.width / COLS, COLS - 1);
  const y = span(box.y, box.h, view.height / ROWS, ROWS - 1);

  return { x0: x.lo, y0: y.lo, x1: x.hi, y1: y.hi };
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
   * A drawing is an area, not a sentence.
   *
   * Filled with one character across its whole rectangle, so the agent
   * perceives *that something occupies this space* and can aim at it, and
   * learns nothing at all about what is in it. A canvas game stays exactly as
   * unreadable as it is to a squinting person watching it move too fast to
   * follow; it simply stops being invisible.
   *
   * Only unclaimed cells, like everything else — a caption drawn over a canvas
   * was painted before this and keeps its characters.
   */
  if (box.kind === "drawing") {
    for (let y = y0; y <= y1; y++) {
      const row = rows[y];
      const mark = claimed[y];
      if (!row || !mark) continue;
      for (let x = x0; x <= x1; x++) {
        if (x >= COLS || mark[x]) continue;
        row[x] = "░";
        mark[x] = true;
      }
    }
    return;
  }

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
    /* Three things with no text still matter: an opaque panel, which hides
       what is behind it; an empty field, which is a rectangle somebody can see
       and click; and a drawing, which is a thing on the screen that happens
       not to be made of words. Everything else with nothing to say is layout,
       and the agent never hears of it. */
    .filter(
      ({ box }) =>
        box.w > 0 &&
        box.h > 0 &&
        (box.text.trim().length > 0 ||
          box.opaque === true ||
          box.kind === "field" ||
          box.kind === "drawing"),
    )
    /* Descending: higher z first, and within one z the later element, because
       later in the document is what sits on top when nothing says otherwise. */
    .sort((a, b) => (b.box.z ?? 0) - (a.box.z ?? 0) || b.i - a.i);

  for (const { box } of ordered) paint(rows, claimed, box, view);

  /* Reading order for the human-facing list, whatever order they were painted
     in — an agent scanning for a button should find them the way a person
     would, down the screen and then across it. */
  const regions: Region[] = ordered
    .filter(
      ({ box }) =>
        box.kind !== "text" &&
        (box.text.trim().length > 0 || box.kind === "field" || box.kind === "drawing"),
    )
    .map(({ box }) => {
      const { x0, y0, x1, y1 } = toCells(box, view);
      return {
        x: x0,
        y: y0,
        w: x1 - x0 + 1,
        h: y1 - y0 + 1,
        kind: box.kind,
        /* Deliberately content-free for a drawing, and deliberately not
           "image" or "canvas" either — those are tag names, and the agent is
           never told a tag name. What a person gets is: there is something
           here, it is not words, look at it. */
        label:
          box.kind === "drawing"
            ? "something you cannot read"
            : box.text.replace(/\s+/g, " ").trim().slice(0, 40) || "(empty)",
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
