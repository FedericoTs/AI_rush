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
  /**
   * Drawn faded — the way an unavailable control looks.
   *
   * Read off how it is painted, not off any attribute: this game greys a
   * disabled button to `opacity: 0.4`, and a person sees that instantly and
   * knows not to bother. Withholding it made the agent strictly worse off
   * than a human for no design reason, and it cost a whole level. See
   * `Region.dim`.
   */
  dim?: boolean;
  /**
   * A point known to be on the thing itself, in pixels.
   *
   * `x`/`y`/`w`/`h` are an *axis-aligned* box, and for anything the page has
   * rotated that box is bigger than the shape inside it and its corners are
   * empty. The `Rotate` modifier tilts a card fifteen degrees, which turns a
   * 400×44 input into a 326×120 bounding box whose top-left is nowhere near
   * the field — so every coordinate published from that corner missed, and any
   * level dealt that modifier became unclickable.
   *
   * The extractor already hit-tests each element's centre to decide it is
   * visible at all. This is that same point, carried through, so the region
   * list can advertise somewhere the mouse actually lands.
   */
  cx?: number;
  cy?: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Region {
  /**
   * Where to click. Not the corner — the spot.
   *
   * It used to be the top-left cell of the bounding box, on the theory that
   * any cell of a box is as good as any other. That holds only while nothing
   * is rotated: under the `Rotate` modifier the bounding box is a tilted
   * rectangle's shadow, its corners are empty space, and a click aimed there
   * hits the page behind. `w`/`h` still give the extent; this gives the point.
   */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: Box["kind"];
  /** Trimmed to something a line of reasoning can refer to. */
  label: string;
  /**
   * It looks greyed out.
   *
   * Present only when true, and it is appearance rather than structure — the
   * agent is told a control is *drawn* faded, exactly as a person sees it, and
   * not that some attribute is set.
   *
   * A blind run lost L05 to the absence of this. The level's honest solve is
   * the Legitimate Interest tab, whose "Object to all" switches off all
   * forty-seven partners and lights up Accept All. The agent found the tab,
   * pressed the button, saw a screen with identical characters on it, and
   * concluded the control was inert:
   *
   *   "Object to all on the Legitimate Interest pane produces no state change
   *   at all"
   *
   * It had just solved the level and could not see that it had. A greyed
   * button turning solid is the single most common state change in this whole
   * catalogue, and the grid was silent about all of it.
   */
  dim?: boolean;
}

export interface Look {
  /** ROWS lines of exactly COLS characters. */
  grid: string[];
  /** The things a person would say are on screen, top to bottom. */
  regions: Region[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * A button with no words on it — a switch, a stepper, a bare icon.
 *
 * Worth reporting, because a person sees one and can press it: L05's six
 * consent toggles are exactly this, and dropping them left the agent reading
 * six category names with no control anywhere near them.
 *
 * The size ceiling is the whole subtlety. A modal backdrop is also a textless
 * clickable rectangle, and it is emphatically *not* something to aim at —
 * announcing it would have the agent clicking the dark area behind a dialog
 * because we called it a button. A control is a thing the size of a thumb; at
 * a quarter of the screen it has stopped being one.
 */
function isUnlabelledControl(box: Box, view: Viewport): boolean {
  return (
    box.kind === "button" &&
    !box.text.trim() &&
    box.w * box.h < view.width * view.height * 0.25
  );
}

/**
 * The cell to aim a click at.
 *
 * `Arena.toPixels` turns a grid coordinate back into the pixel at that cell's
 * centre, so the useful answer is the cell whose centre sits closest to a point
 * we know is on the element — never a corner, which under any rotation is
 * empty space.
 *
 * Falls back to the bounding box's own centre when the extractor did not
 * supply a hit point. That is the right default anyway: the middle of a
 * control is where a person puts their finger.
 */
function aimCell(box: Box, view: Viewport): { x: number; y: number } {
  const cw = view.width / COLS;
  const ch = view.height / ROWS;
  const px = box.cx ?? box.x + box.w / 2;
  const py = box.cy ?? box.y + box.h / 2;
  /* Nearest cell centre, not the containing cell: it halves the worst-case
     distance between where we aim and the point we actually meant. */
  return {
    x: clamp(Math.round(px / cw - 0.5), 0, COLS - 1),
    y: clamp(Math.round(py / ch - 0.5), 0, ROWS - 1),
  };
}

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
  const width = Math.max(1, x1 - x0 + 1);

  /*
   * An unlabelled button is drawn as one, for the same reason an empty field
   * is drawn as underscores: a person sees a switch there, and reporting a
   * blank leaves an agent reading a category name with nothing to press.
   *
   * Brackets rather than a fill, so it reads as a control rather than as the
   * `░` of something unreadable. What it does NOT say is which way the switch
   * is thrown — that is state, it is legible on screen, and inferring it from
   * a knob's offset would be us reading the DOM on the agent's behalf. L05
   * prints "46 of 47 partners enabled" in plain text; working out which one is
   * the odd one is the level.
   */
  const empty =
    box.kind === "field"
      ? "_".repeat(width)
      : isUnlabelledControl(box, view)
        ? width >= 3
          ? `[${"-".repeat(width - 2)}]`
          : "[]".slice(0, width)
        : "";

  const text = box.text.trim() ? box.text.replace(/\s+/g, " ").trim() : empty;

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
       and click; an unlabelled button, which is a switch somebody can see and
       press; and a drawing, which is a thing on the screen that happens
       not to be made of words. Everything else with nothing to say is layout,
       and the agent never hears of it. */
    .filter(
      ({ box }) =>
        box.w > 0 &&
        box.h > 0 &&
        (box.text.trim().length > 0 ||
          box.opaque === true ||
          box.kind === "field" ||
          box.kind === "drawing" ||
          isUnlabelledControl(box, view)),
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
        (box.text.trim().length > 0 ||
          box.kind === "field" ||
          box.kind === "drawing" ||
          isUnlabelledControl(box, view)),
    )
    .map(({ box }) => {
      const { x0, y0, x1, y1 } = toCells(box, view);
      const aim = aimCell(box, view);
      return {
        /* The point, clamped into the box's own cells so a region never
           advertises a coordinate outside its stated extent. */
        x: clamp(aim.x, x0, x1),
        y: clamp(aim.y, y0, y1),
        w: x1 - x0 + 1,
        h: y1 - y0 + 1,
        kind: box.kind,
        /* Only when true, so a region carries the note exactly when a person
           would see the fade. */
        ...(box.dim ? { dim: true as const } : {}),
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
        .map((r) => `  (${r.x},${r.y}) ${r.kind.padEnd(7)} ${r.label}${r.dim ? "  (greyed out)" : ""}`)
        .join("\n")
    : "  (none)";

  return [
    `   ${tens}`,
    `   ${ones}`,
    `  ┌${"─".repeat(COLS)}┐`,
    body,
    `  └${"─".repeat(COLS)}┘`,
    "",
    /* The coordinate is the spot, not a corner to explore from — under a
       rotation the corners of a region are empty space. */
    "Distinct regions (the coordinate is where to click):",
    regions,
  ].join("\n");
}
