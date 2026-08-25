import { chromium, type Browser, type Page } from "playwright";
import { COLS, ROWS, rasterize, render } from "./raster";
import { extractBoxes } from "./extract";
import { prepareContext } from "./page";
import { arenaUrl, operatorFromEnv } from "./url";

/**
 * One run of AI Rush, driven from outside, perceived as a character grid.
 *
 * Lifted out of `server.ts` so that MCP is a *transport* rather than the
 * thing itself. There is now a second one (`harness.ts`, over HTTP) and there
 * will be a third when battles are replayed headlessly, and every one of them
 * has to perceive and act **identically** — the moment two transports disagree
 * about what `look()` returns, every result either of them produces stops
 * being comparable to the other's, which is the one thing the Arena is for.
 *
 * So the rule for this file: transports own schemas, descriptions, and how a
 * turn is delivered. This owns the browser, the grid, and the pixel each grid
 * cell maps to. Nothing about perception lives in a transport.
 */

export const GAME_URL = process.env.ARENA_URL ?? "https://ai-rush.lol";

/**
 * Who this harness says it is, from `ARENA_AGENT` / `ARENA_OPERATOR`.
 *
 * Unset by default, and that means the run is not filed anywhere at all —
 * somebody trying the server out gets a private game, and appearing on a
 * public table is a thing you opt into by naming yourself. Named, the run is
 * filed in the agent tables, which never touch the human board.
 */
export const WHO = operatorFromEnv();

/* A phone-shaped viewport. Most of the catalogue is designed portrait-first,
   and a desktop-width window would show several levels in a layout no human
   player is being scored on. */
export const VIEWPORT = { width: 480, height: 720 };

/** Seconds an agent may burn in one `wait`. Long enough for a real animation,
    short enough that L22's infinite progress bar stays a joke and not a hang. */
export const MAX_WAIT_MS = 10_000;

/**
 * Grid rows one `scroll` may move. A full screen is 24, and a person flicking
 * a long consent list covers about that in one go; more than that in a single
 * action stops being a hand and starts being a jump-to-offset.
 */
export const MAX_SCROLL_ROWS = 24;

/** The keys an agent may press. Every transport offers exactly these. */
export const KEYS = [
  "Tab", "Enter", "Escape", "Backspace",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space",
] as const;

export type KeyName = (typeof KEYS)[number];

export interface Turn {
  n: number;
  tool: string;
  why: string;
  /** Milliseconds since the run opened. The clock is the whole game. */
  atMs: number;
}

export const NO_RUN = "No run open. Call `start` first.";

export class Arena {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private turns: Turn[] = [];
  private openedAt = 0;

  async open(seed: string | undefined): Promise<Page> {
    if (this.page) return this.page;

    /* Same escape hatch as `playwright.config.ts`: a sandbox or a container
       with a pre-installed browser points at it rather than downloading one.
       Unset everywhere else, so a normal machine resolves it normally. */
    this.browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
    });
    const context = await this.browser.newContext({ viewport: VIEWPORT });
    await prepareContext(context, WHO);

    this.page = await context.newPage();
    this.openedAt = Date.now();
    await this.page.goto(arenaUrl(GAME_URL, seed, WHO), { waitUntil: "domcontentloaded" });

    /* The deck is dealt on the client, so `domcontentloaded` fires on an empty
       stage. Without this the agent's first turn is spent looking at nothing —
       and the clock is already running, which makes it the most expensive turn
       of the run to waste. Bounded, and it gives up quietly: a genuinely blank
       screen is a legitimate thing to perceive. */
    await this.page.waitForSelector("[data-level]", { timeout: 15_000 }).catch(() => {});
    return this.page;
  }

  /** The live page, or null before `start`. Every tool checks this. */
  current(): Page | null {
    return this.page;
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }

  /** The turn log, which is the thing worth reading afterwards. */
  record(tool: string, why: string): Turn {
    const turn = {
      n: this.turns.length + 1,
      tool,
      why,
      atMs: this.openedAt ? Date.now() - this.openedAt : 0,
    };
    this.turns.push(turn);
    /* stderr, so the transcript survives without contaminating the protocol on
       stdout. This is the feed, until there is a page to put it on. */
    process.stderr.write(`turn ${turn.n} · ${tool} · ${why}\n`);
    return turn;
  }

  history(): Turn[] {
    return this.turns;
  }

  /** Grid cell → the pixel at its centre, which is where a click lands. */
  toPixels(x: number, y: number): { px: number; py: number } {
    return {
      px: Math.round((x + 0.5) * (VIEWPORT.width / COLS)),
      py: Math.round((y + 0.5) * (VIEWPORT.height / ROWS)),
    };
  }

  async look(): Promise<string> {
    const page = this.page;
    if (!page) return NO_RUN;

    let shot = await page.evaluate(extractBoxes);

    /* One retry on a completely empty screen.
     *
     * A level swapping for the next one leaves the stage blank for a frame or
     * two, and reporting "there is nothing here" is not lossy, it is wrong —
     * an agent told the screen is empty will reasonably conclude the run ended
     * and start doing something strange. A genuinely blank screen survives the
     * retry and is reported honestly. */
    if (shot.boxes.length === 0) {
      await page.waitForTimeout(400);
      shot = await page.evaluate(extractBoxes);
    }

    const out = render(rasterize(shot.boxes, shot.view));

    return shot.finished ? `${out}\n\nThe run is over. This is the tally screen.` : out;
  }

  /* ── the actions ──────────────────────────────────────────────────────
     One method per tool, so a transport is a schema and a call and nothing
     else. Each returns the screen afterwards, because the screen after an
     action is the only feedback the game gives. */

  async click(x: number, y: number): Promise<string> {
    if (!this.page) return NO_RUN;
    const { px, py } = this.toPixels(x, y);
    await this.page.mouse.click(px, py);
    return this.look();
  }

  /*
   * ── Native dropdowns, and a headless browser's blind spot ──────────────
   *
   * A focused `<select>` in a real browser answers to the arrow keys and to
   * typing the first letters of an option. Headless Chromium drops both,
   * because the work is done by the operating system's popup and there isn't
   * one — so a select could be focused by a click and then not respond to any
   * honest verb. The fifth blind run found the only thing that did work, by
   * accident, and could not explain it:
   *
   *   "with ~25 seconds left I guessed it was a flick-wheel like the previous
   *   level — drag set it to Japan instantly"
   *
   * That is a headless artifact, not a level. These two helpers restore the
   * behaviour a person gets in a real browser and nothing more: the value
   * moves, the page hears `input` and `change`, and the agent still has to
   * look to find out what it landed on. It is told no more about the list
   * than a person sees.
   */
  private async selectStep(delta: number): Promise<boolean> {
    return this.page!.evaluate((d) => {
      const el = document.activeElement;
      if (!el || el.tagName !== "SELECT") return false;
      const sel = el as HTMLSelectElement;
      const next = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + d));
      if (next !== sel.selectedIndex) {
        sel.selectedIndex = next;
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    }, delta);
  }

  private async selectJump(prefix: string): Promise<boolean> {
    return this.page!.evaluate((p) => {
      const el = document.activeElement;
      if (!el || el.tagName !== "SELECT") return false;
      const sel = el as HTMLSelectElement;
      const want = p.trim().toLowerCase();
      if (!want) return true;
      /* Type-ahead, exactly as a browser does it: first option whose label
         starts with what was typed. */
      const i = Array.from(sel.options).findIndex((o) =>
        (o.textContent ?? "").trim().toLowerCase().startsWith(want),
      );
      if (i >= 0 && i !== sel.selectedIndex) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    }, prefix);
  }

  async type(text: string): Promise<string> {
    if (!this.page) return NO_RUN;
    if (await this.selectJump(text)) return this.look();
    await this.page.keyboard.type(text, { delay: 12 });
    return this.look();
  }

  async key(name: KeyName): Promise<string> {
    if (!this.page) return NO_RUN;
    if (name === "ArrowDown" || name === "ArrowUp") {
      if (await this.selectStep(name === "ArrowDown" ? 1 : -1)) return this.look();
    }
    await this.page.keyboard.press(name);
    return this.look();
  }

  async drag(x1: number, y1: number, x2: number, y2: number): Promise<string> {
    if (!this.page) return NO_RUN;
    const from = this.toPixels(x1, y1);
    const to = this.toPixels(x2, y2);
    await this.page.mouse.move(from.px, from.py);
    await this.page.mouse.down();
    /* In steps, because several levels are watching the movement rather than
       the endpoints — a teleporting pointer reads as a script, and at least one
       level is specifically about where your cursor came from. */
    await this.page.mouse.move(to.px, to.py, { steps: 12 });
    await this.page.mouse.up();
    return this.look();
  }

  /**
   * Scroll whatever is under a grid coordinate.
   *
   * Added because two blind runs died on L05 in exactly the same way: its
   * forty-seven consent partners scroll inside a fixed box, the extractor
   * correctly withholds the rows below the fold, and the agent had no action
   * that could bring them into view. It poked six controls, got nothing, and
   * skipped — twice. That is not a hard level, it is a level with no legal
   * move, and there is one in the catalogue called *Scroll To Accept*.
   *
   * Aimed at a coordinate rather than applied to the page, because that is the
   * distinction that matters: a person puts a finger on the list and moves
   * *that*, while the page behind it stays put. Scrolling the window instead
   * would leave L05 exactly as unplayable as it was.
   *
   * It hands over no structure. Where the scrollable regions are, how far they
   * go, and whether anything moved at all remain things to work out by looking.
   */
  async scroll(x: number, y: number, rows: number): Promise<string> {
    if (!this.page) return NO_RUN;
    const { px, py } = this.toPixels(x, y);
    const clamped = Math.max(-MAX_SCROLL_ROWS, Math.min(MAX_SCROLL_ROWS, Math.round(rows)));
    /* The pointer has to be over the thing first — `wheel` goes wherever the
       mouse currently is, which is the same rule a trackpad follows. */
    await this.page.mouse.move(px, py);
    await this.page.mouse.wheel(0, clamped * (VIEWPORT.height / ROWS));
    /* A beat for smooth-scrolling containers to land, or the agent reads the
       screen mid-flight and concludes nothing happened. */
    await this.page.waitForTimeout(220);
    return this.look();
  }

  async wait(ms: number): Promise<string> {
    if (!this.page) return NO_RUN;
    await this.page.waitForTimeout(Math.min(Math.max(100, ms), MAX_WAIT_MS));
    return this.look();
  }

  async skip(): Promise<string> {
    if (!this.page) return NO_RUN;
    await this.page
      .getByRole("button", { name: "SKIP THIS LEVEL" })
      .click()
      .catch(() => {});
    return this.look();
  }
}
