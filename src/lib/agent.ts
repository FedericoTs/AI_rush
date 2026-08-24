/**
 * The arena marker: how the game finds out it is being played by a machine.
 *
 * The Agent Arena drives a real browser at the real site, so an agent's run
 * goes through exactly the same client, the same clock and the same scoring as
 * a person's — which is the only way the asymmetry table means anything. The
 * one thing that must differ is where the run is filed: `AGENT_ARENA.md` §6
 * says the agent board is separate from the human board *always*, and until
 * this existed an agent's run landed in `run_events` alongside everybody
 * else's. That would have made the table's human column humans-plus-agents,
 * and the more agents played the more the two columns would converge for
 * purely arithmetic reasons.
 *
 * So the harness writes one key into the page's storage before it loads
 * (`src/arena/page.ts`), and this reads it back:
 *
 *     localStorage["ai-rush:arena"] = '{"agent":"claude-opus-5",
 *                                       "operator":"@handle",
 *                                       "harness":"mcp/0.1"}'
 *
 * ── And why the name is also on the URL ─────────────────────────────────
 *
 * Storage can be blocked, and the failure is silent and asymmetric: a lost
 * marker does not mean an unfiled run, it means a machine's run filed as a
 * person's, in the one table the whole comparison is drawn from. So the
 * harness also appends `?arena=<name>` and this prefers it. Two independent
 * channels, both set by the same call, and the run has to lose both before it
 * can be mistaken for a human's.
 *
 * A person can obviously set either of them. What it buys them is removal from
 * the human board and a row on an aggregate with no rank to climb — graffiti,
 * not an exploit. The reasoning is written out at the top of
 * `supabase/migrations/0005_arena.sql`, next to the tables it applies to.
 */

export const ARENA_KEY = "ai-rush:arena";

/** The query parameter carrying the agent's name. `src/arena/url.ts` writes it. */
export const ARENA_PARAM = "arena";

export interface AgentIdentity {
  /** What the operator calls the thing they wired up. */
  agent: string;
  /** Whose harness it is, for the credit in §7. Optional. */
  operator?: string;
  /** Free text: `mcp/0.1`, a scaffold name, whatever is useful later. */
  harness?: string;
}

/* Mirrors the check constraint on `agent_runs.agent`. Rejecting here as well
   means a malformed marker is a run filed as human rather than a run that
   silently fails to file at all. */
const NAME = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$/;
const HANDLE = /^@?[A-Za-z0-9_]{1,15}$/;

function stored(): Partial<AgentIdentity> {
  try {
    const raw = window.localStorage.getItem(ARENA_KEY);
    return raw ? (JSON.parse(raw) as Partial<AgentIdentity>) : {};
  } catch {
    /* Blocked, or somebody put a sentence in there. Either way the URL is
       still a complete answer on its own. */
    return {};
  }
}

function fromUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get(ARENA_PARAM)?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * The marker, or null for the overwhelmingly common case of a person.
 *
 * Never throws. Every failure resolves to one of two answers — a valid agent
 * or a human — and both are safe; what would not be safe is an exception
 * thrown out of the effect that opens the run.
 */
export function agentIdentity(): AgentIdentity | null {
  if (typeof window === "undefined") return null;

  const saved = stored();
  /* URL first. It is the channel that survives storage being unavailable, and
     the one failure mode worth engineering against is a marker lost silently
     on a run that then files as a person's. */
  const agent = fromUrl() || String(saved.agent ?? "").trim();
  if (!NAME.test(agent)) return null;

  const operator = String(saved.operator ?? "").trim();
  const harness = String(saved.harness ?? "").trim();

  return {
    agent,
    ...(HANDLE.test(operator) ? { operator } : {}),
    ...(harness ? { harness: harness.slice(0, 40) } : {}),
  };
}
