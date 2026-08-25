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

  async type(text: string): Promise<string> {
    if (!this.page) return NO_RUN;
    await this.page.keyboard.type(text, { delay: 12 });
    return this.look();
  }

  async key(name: KeyName): Promise<string> {
    if (!this.page) return NO_RUN;
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
