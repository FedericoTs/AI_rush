import type { Operator } from "./page";

/**
 * The URL an agent's run opens at.
 *
 * One function so the two channels that mark a run as an agent's — this
 * parameter and the storage key in `page.ts` — are always set by the same
 * call. They exist in duplicate on purpose (see `src/lib/agent.ts`): the
 * failure worth engineering against is not a lost run, it is a machine's run
 * quietly filed as a person's in the table the whole comparison is drawn from.
 */
export function arenaUrl(base: string, seed?: string, who?: Operator): string {
  const url = new URL("/play", base);
  if (seed) url.searchParams.set("seed", seed);
  if (who?.agent) url.searchParams.set("arena", who.agent);
  return url.toString();
}

/**
 * Who is playing, from the environment.
 *
 * `ARENA_AGENT` is what the operator calls their setup and is the only one
 * that matters — without it the harness plays anonymously and the run is not
 * filed at all, which is the right default for somebody trying the server out
 * before deciding whether they want to be on a public table.
 */
export function operatorFromEnv(env: NodeJS.ProcessEnv = process.env): Operator | undefined {
  const agent = (env.ARENA_AGENT ?? "").trim();
  if (!agent) return undefined;
  const operator = (env.ARENA_OPERATOR ?? "").trim();
  const harness = (env.ARENA_HARNESS ?? "").trim();
  return {
    agent,
    ...(operator ? { operator } : {}),
    ...(harness ? { harness } : { harness: "mcp/0.1" }),
  };
}
