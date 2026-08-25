#!/usr/bin/env -S npx tsx
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { Arena, GAME_URL, KEYS, MAX_WAIT_MS, type KeyName } from "./arena";
import { COLS, ROWS } from "./raster";

/**
 * The same arena, over HTTP, for an agent that cannot speak MCP.
 *
 * The gate in `ROADMAP.md` 6.5a is *is watching this funny?*, and answering it
 * needs a transcript from something that has never seen this repository. Not
 * every such thing is an MCP client — a shell loop, a notebook, a harness
 * somebody wrote in an afternoon — and requiring one to run the experiment
 * would mean the gate stays unanswered because of a protocol.
 *
 * Perception and actions come from `arena.ts` unchanged, deliberately: a run
 * played through here is comparable with one played through MCP because both
 * are literally the same `look()` over the same rasterizer. This file adds a
 * transport and one thing MCP got from zod for free —
 *
 *   **`why` is refused, not defaulted.** A request without it gets a 400 and
 *   no action is taken. That is the same contract the MCP schema enforces, and
 *   it is the entire content of the mode: an agent that has to state a belief
 *   before it acts produces the only artifact anybody would watch. Making it
 *   optional over a second transport would quietly turn the Arena back into a
 *   browser-automation endpoint.
 *
 * It binds to loopback and it does not authenticate, which is fine for exactly
 * what it is — a local experiment runner started by hand, for one run, killed
 * afterwards. Do not put it on a network.
 */

const PORT = Number(process.env.ARENA_HARNESS_PORT ?? 4700);
const TRANSCRIPT = process.env.ARENA_TRANSCRIPT ?? "";

const arena = new Arena();

interface Act {
  tool?: string;
  why?: string;
  seed?: string;
  x?: number; y?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  text?: string;
  name?: string;
  ms?: number;
}

const HELP = [
  "AI Rush — arena harness.",
  "",
  `POST /act  {"tool":"start","why":"..."}            open a run`,
  `           {"tool":"look","why":"..."}             the screen, as a ${COLS}x${ROWS} grid`,
  `           {"tool":"click","x":0,"y":0,"why":"..."}`,
  `           {"tool":"type","text":"...","why":"..."}`,
  `           {"tool":"key","name":"Enter","why":"..."}`,
  `           {"tool":"drag","x1":0,"y1":0,"x2":0,"y2":0,"why":"..."}`,
  `           {"tool":"wait","ms":2000,"why":"..."}   up to ${MAX_WAIT_MS}ms`,
  `           {"tool":"skip","why":"..."}             costs ten seconds`,
  "",
  "GET  /transcript   every turn so far, with its stated reason",
  "",
  "`why` is required on every action. Without it the call is refused and",
  "nothing happens — you commit to a belief before you find out.",
].join("\n");

const clamp = (v: unknown, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

async function act(body: Act): Promise<{ status: number; text: string }> {
  const tool = String(body.tool ?? "");
  const why = String(body.why ?? "").trim();

  if (!tool) return { status: 400, text: "No `tool`.\n\n" + HELP };
  /* The one rule this transport has to carry itself. */
  if (!why) {
    return {
      status: 400,
      text: "`why` is required, and nothing was done. Say what you believe is "
        + "true and what you expect this to achieve, in one sentence, before "
        + "you find out whether it worked.",
    };
  }

  const turn = arena.record(tool, why);
  const stamp = (out: string) => ({ status: 200, text: `turn ${turn.n} · ${turn.atMs}ms\n\n${out}` });

  switch (tool) {
    case "start":
      await arena.open(body.seed ? String(body.seed) : undefined);
      return stamp(await arena.look());
    case "look":
      return stamp(await arena.look());
    case "click":
      return stamp(await arena.click(clamp(body.x, 0, COLS - 1), clamp(body.y, 0, ROWS - 1)));
    case "type":
      return stamp(await arena.type(String(body.text ?? "").slice(0, 200)));
    case "key": {
      const name = String(body.name ?? "");
      if (!(KEYS as readonly string[]).includes(name)) {
        return { status: 400, text: `Unknown key. One of: ${KEYS.join(", ")}` };
      }
      return stamp(await arena.key(name as KeyName));
    }
    case "drag":
      return stamp(
        await arena.drag(
          clamp(body.x1, 0, COLS - 1), clamp(body.y1, 0, ROWS - 1),
          clamp(body.x2, 0, COLS - 1), clamp(body.y2, 0, ROWS - 1),
        ),
      );
    case "wait":
      return stamp(await arena.wait(clamp(body.ms, 100, MAX_WAIT_MS)));
    case "skip":
      return stamp(await arena.skip());
    default:
      return { status: 400, text: `Unknown tool "${tool}".\n\n${HELP}` };
  }
}

const server = createServer((req, res) => {
  const send = (status: number, text: string) => {
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(text);
  };

  if (req.method === "GET" && req.url === "/transcript") {
    return send(
      200,
      arena.history().map((t) => `${t.n}\t${t.atMs}ms\t${t.tool}\t${t.why}`).join("\n"),
    );
  }
  if (req.method !== "POST" || req.url !== "/act") return send(200, HELP);

  let raw = "";
  req.on("data", (c) => {
    raw += c;
    /* A body this size is a bug or a loop, and either way reading the rest of
       it helps nobody. */
    if (raw.length > 64_000) req.destroy();
  });
  req.on("end", () => {
    let body: Act;
    try {
      body = JSON.parse(raw || "{}") as Act;
    } catch {
      return send(400, "Body must be JSON.\n\n" + HELP);
    }
    void act(body)
      .then((r) => send(r.status, r.text))
      /* An action that threw is still a turn that happened, and the agent has
         to be told something true about it rather than left waiting. */
      .catch((err: unknown) => send(500, `That failed: ${String(err)}`));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(`arena harness on http://127.0.0.1:${PORT} → ${GAME_URL}\n`);
});

const shutdown = async () => {
  const turns = arena.history();
  if (TRANSCRIPT) {
    writeFileSync(TRANSCRIPT, JSON.stringify(turns, null, 2));
    process.stderr.write(`\n${turns.length} turns → ${TRANSCRIPT}\n`);
  } else {
    process.stderr.write(`\n${turns.length} turns.\n`);
  }
  await arena.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
