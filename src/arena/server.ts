#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium, type Browser, type Page } from "playwright";
import { z } from "zod";
import { COLS, ROWS, rasterize, render } from "./raster";
import { extractBoxes } from "./extract";
import { prepareContext } from "./page";

/**
 * The Agent Arena, cheap first version.
 *
 * `AGENT_ARENA.md` §9: "the MCP server, `look()`, the existing 48 levels, and
 * a plain text feed. No silicon tier, no spectator page. That's about a week,
 * and it's enough to find out whether watching an agent play this is actually
 * as funny as it sounds before committing to the rest. Do that first."
 *
 * This is that. The gate it exists to answer is in `ROADMAP.md` 6.5a — *is
 * watching this funny?* — and if the answer is no, one week has been spent
 * rather than seventeen days.
 *
 * ── What the agent can and cannot do ─────────────────────────────────────
 *
 * It sees a 48×24 character grid and a list of visually distinct regions. It
 * does not see the DOM, an accessibility tree, selectors, element ids, or the
 * contents of a password field. It acts by grid coordinate, and it is told
 * nothing about its own state — where focus is, what it typed, what the dials
 * are set to. All of that is the game.
 *
 * `why` is required by schema on every action, not by convention. The call
 * fails validation without it. That is not telemetry: it is the content. Every
 * action produces a timestamped sentence committing the agent to a belief
 * *before* it finds out, and those sentences are the entire reason anybody
 * would watch.
 *
 * ── What this server owes its operator (§8) ──────────────────────────────
 *
 * Stated here, in the tool descriptions, and at run start rather than buried:
 * it has no side effects outside a sandboxed browser pointed at one game, it
 * cannot read a filesystem or reach another origin, and it returns characters
 * and a score. Reasoning is printed to this process's stderr and returned to
 * the caller; **this version publishes nothing**, because there is no
 * spectator page yet. When there is one, that changes and the notice changes
 * with it.
 */

const GAME_URL = process.env.ARENA_URL ?? "https://ai-rush.lol";

/* A phone-shaped viewport. Most of the catalogue is designed portrait-first,
   and a desktop-width window would show several levels in a layout no human
   player is being scored on. */
const VIEWPORT = { width: 480, height: 720 };

/** Seconds an agent may burn in one `wait`. Long enough for a real animation,
    short enough that L22's infinite progress bar stays a joke and not a hang. */
const MAX_WAIT_MS = 10_000;

interface Turn {
  n: number;
  tool: string;
  why: string;
}

class Arena {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private turns: Turn[] = [];

  async open(seed: string | undefined): Promise<Page> {
    if (this.page) return this.page;

    /* Same escape hatch as `playwright.config.ts`: a sandbox or a container
       with a pre-installed browser points at it rather than downloading one.
       Unset everywhere else, so a normal machine resolves it normally. */
    this.browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
    });
    const context = await this.browser.newContext({ viewport: VIEWPORT });
    await prepareContext(context);

    this.page = await context.newPage();
    const url = new URL("/play", GAME_URL);
    if (seed) url.searchParams.set("seed", seed);
    await this.page.goto(url.toString(), { waitUntil: "domcontentloaded" });

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
    const turn = { n: this.turns.length + 1, tool, why };
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
    if (!page) return "No run open. Call `start` first.";

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

    return shot.finished
      ? `${out}\n\nThe run is over. This is the tally screen.`
      : out;
  }
}

const arena = new Arena();

const server = new McpServer({ name: "ai-rush-arena", version: "0.1.0" });

/* Every action carries this. It is not optional and it is not a comment: an
   agent that has to state a belief before acting produces the transcript this
   whole mode exists to read. */
const WHY = z
  .string()
  .min(1)
  .describe(
    "Why you are doing this, in one sentence, written before you find out whether it worked.",
  );

const COORD = {
  x: z.number().int().min(0).max(COLS - 1).describe(`Grid column, 0–${COLS - 1}.`),
  y: z.number().int().min(0).max(ROWS - 1).describe(`Grid row, 0–${ROWS - 1}.`),
};

server.tool(
  "start",
  [
    "Open a five-minute run of AI Rush and return the first screen.",
    "",
    "The clock starts now and does not stop — not for your turns, not for a",
    "wait, not for anything. Everything you do here happens inside a sandboxed",
    "browser pointed at one game; this server cannot reach a filesystem, another",
    "origin, or any other tool.",
    "",
    "Your `why` strings are returned to whoever is running you and printed to",
    "this process's log. This version publishes nothing anywhere else.",
  ].join("\n"),
  {
    seed: z.string().optional().describe("Play a specific run. Omit for a fresh one."),
    why: WHY,
  },
  async ({ seed, why }) => {
    arena.record("start", why);
    await arena.open(seed);
    return { content: [{ type: "text", text: await arena.look() }] };
  },
);

server.tool(
  "look",
  [
    "The screen, as a 48×24 character grid plus the regions you can click.",
    "",
    "This is a coarse spatial rendering, not the page source. There are no",
    "selectors, no element ids and no accessibility tree — text sits roughly",
    "where it is drawn, and small text is small. Nothing tells you where the",
    "focus is or what you have already typed; that is yours to track.",
  ].join("\n"),
  { why: WHY },
  async ({ why }) => {
    arena.record("look", why);
    return { content: [{ type: "text", text: await arena.look() }] };
  },
);

server.tool(
  "click",
  "Click at a grid coordinate. Nothing is guaranteed to be there.",
  { ...COORD, why: WHY },
  async ({ x, y, why }) => {
    arena.record("click", why);
    const page = arena.current();
    if (!page) return { content: [{ type: "text", text: "No run open. Call `start` first." }] };

    const { px, py } = arena.toPixels(x, y);
    await page.mouse.click(px, py);
    return { content: [{ type: "text", text: await arena.look() }] };
  },
);

server.tool(
  "type",
  [
    "Type into whatever currently has focus.",
    "",
    "Nothing tells you where focus is. If you have not put it somewhere, this",
    "goes wherever the page last left it.",
  ].join("\n"),
  { text: z.string().max(200), why: WHY },
  async ({ text, why }) => {
    arena.record("type", why);
    const page = arena.current();
    if (!page) return { content: [{ type: "text", text: "No run open. Call `start` first." }] };

    await page.keyboard.type(text, { delay: 12 });
    return { content: [{ type: "text", text: await arena.look() }] };
  },
);

server.tool(
  "key",
  "Press a single key: Tab, Enter, Escape, Backspace, ArrowUp/Down/Left/Right, Space.",
  {
    name: z.enum([
      "Tab", "Enter", "Escape", "Backspace",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space",
    ]),
    why: WHY,
  },
  async ({ name, why }) => {
    arena.record("key", why);
    const page = arena.current();
    if (!page) return { content: [{ type: "text", text: "No run open. Call `start` first." }] };

    await page.keyboard.press(name);
    return { content: [{ type: "text", text: await arena.look() }] };
  },
);

server.tool(
  "drag",
  "Press at one grid coordinate, move to another, release.",
  {
    x1: COORD.x, y1: COORD.y, x2: COORD.x, y2: COORD.y,
    why: WHY,
  },
  async ({ x1, y1, x2, y2, why }) => {
    arena.record("drag", why);
    const page = arena.current();
    if (!page) return { content: [{ type: "text", text: "No run open. Call `start` first." }] };

    const from = arena.toPixels(x1, y1);
    const to = arena.toPixels(x2, y2);
    await page.mouse.move(from.px, from.py);
    await page.mouse.down();
    /* In steps, because several levels are watching the movement rather than
       the endpoints — a teleporting pointer reads as a script, and at least one
       level is specifically about where your cursor came from. */
    await page.mouse.move(to.px, to.py, { steps: 12 });
    await page.mouse.up();
    return { content: [{ type: "text", text: await arena.look() }] };
  },
);

server.tool(
  "wait",
  [
    `Do nothing for up to ${MAX_WAIT_MS / 1000} seconds, then look again.`,
    "",
    "Some levels genuinely require holding or waiting. Some only appear to.",
    "The clock does not stop.",
  ].join("\n"),
  { ms: z.number().int().min(100).max(MAX_WAIT_MS), why: WHY },
  async ({ ms, why }) => {
    arena.record("wait", why);
    const page = arena.current();
    if (!page) return { content: [{ type: "text", text: "No run open. Call `start` first." }] };

    await page.waitForTimeout(ms);
    return { content: [{ type: "text", text: await arena.look() }] };
  },
);

server.tool(
  "skip",
  "Give up on this level. Costs ten seconds and your combo, exactly as it does for a human.",
  { why: WHY },
  async ({ why }) => {
    arena.record("skip", why);
    const page = arena.current();
    if (!page) return { content: [{ type: "text", text: "No run open. Call `start` first." }] };

    await page.getByRole("button", { name: "SKIP THIS LEVEL" }).click().catch(() => {});
    return { content: [{ type: "text", text: await arena.look() }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

const shutdown = async () => {
  const turns = arena.history();
  process.stderr.write(`\n${turns.length} turns.\n`);
  await arena.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
