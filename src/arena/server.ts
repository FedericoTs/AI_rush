#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { COLS, ROWS } from "./raster";
import { Arena, KEYS, MAX_WAIT_MS, NO_RUN, WHO } from "./arena";

/**
 * The Agent Arena, cheap first version — over MCP.
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
 * The perception and the actions live in `arena.ts`; this file is the schemas
 * and the descriptions. That split is not tidiness — there is a second
 * transport (`harness.ts`) for driving a run without an MCP client, and two
 * transports that disagreed about what `look()` returns would make every
 * result either produced incomparable with the other's.
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
 * and a score.
 *
 * **Reasoning is still not published.** `why` strings go to this process's
 * stderr and back to the caller, and nowhere else — there is no spectator feed
 * yet, and storing them before there is somewhere they were promised to appear
 * would be exactly the kind of quiet collection §8 exists to refuse.
 *
 * What *is* published, and only if the operator names themselves with
 * `ARENA_AGENT`, is the outcome: levels reached, solved, skipped, and how long
 * each took. That is what the asymmetry table at `/arena` is made of. Unnamed,
 * the run is not filed at all.
 */

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

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

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
    "this process's log. They are not sent anywhere and not stored.",
    "",
    WHO
      ? `This run is filed publicly as "${WHO.agent}": which levels were reached,`
        + " solved or skipped, and how long each took. That feeds the asymmetry"
        + " table at /arena. It never touches the human leaderboard."
      : "This run is not recorded anywhere. Set ARENA_AGENT to put your results"
        + " on the public asymmetry table at /arena.",
  ].join("\n"),
  {
    seed: z.string().optional().describe("Play a specific run. Omit for a fresh one."),
    why: WHY,
  },
  async ({ seed, why }) => {
    arena.record("start", why);
    await arena.open(seed);
    return text(await arena.look());
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
    return text(await arena.look());
  },
);

server.tool(
  "click",
  "Click at a grid coordinate. Nothing is guaranteed to be there.",
  { ...COORD, why: WHY },
  async ({ x, y, why }) => {
    arena.record("click", why);
    return text(arena.current() ? await arena.click(x, y) : NO_RUN);
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
  async ({ text: body, why }) => {
    arena.record("type", why);
    return text(arena.current() ? await arena.type(body) : NO_RUN);
  },
);

server.tool(
  "key",
  "Press a single key: Tab, Enter, Escape, Backspace, ArrowUp/Down/Left/Right, Space.",
  { name: z.enum(KEYS), why: WHY },
  async ({ name, why }) => {
    arena.record("key", why);
    return text(arena.current() ? await arena.key(name) : NO_RUN);
  },
);

server.tool(
  "drag",
  "Press at one grid coordinate, move to another, release.",
  { x1: COORD.x, y1: COORD.y, x2: COORD.x, y2: COORD.y, why: WHY },
  async ({ x1, y1, x2, y2, why }) => {
    arena.record("drag", why);
    return text(arena.current() ? await arena.drag(x1, y1, x2, y2) : NO_RUN);
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
    return text(arena.current() ? await arena.wait(ms) : NO_RUN);
  },
);

server.tool(
  "skip",
  "Give up on this level. Costs ten seconds and your combo, exactly as it does for a human.",
  { why: WHY },
  async ({ why }) => {
    arena.record("skip", why);
    return text(arena.current() ? await arena.skip() : NO_RUN);
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
