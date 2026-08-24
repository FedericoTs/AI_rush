import type { BrowserContext } from "playwright";

/** Who is playing, for the marker below. Omitted by the probe, which is not
    playing and must never file a run. */
export interface Operator {
  agent: string;
  operator?: string;
  harness?: string;
}

/**
 * The things every Arena page needs before it loads.
 *
 * Shared by the MCP server and the probe so they cannot drift — a difference
 * between what the probe shows and what an agent sees would make the probe
 * worse than useless.
 */
export async function prepareContext(context: BrowserContext, who?: Operator): Promise<void> {
  /*
   * The arena marker.
   *
   * This is the whole mechanism that keeps an agent's run out of the human
   * board and out of the human column of the asymmetry table. The harness
   * drives the real site with the real client, so without it an agent files
   * exactly like a person — `src/lib/agent.ts` has the reasoning, and
   * `supabase/migrations/0005_arena.sql` has the tables.
   *
   * Written as its own init script rather than folded into the one below, so
   * that a probe run — no operator, no marker — cannot accidentally acquire
   * one by editing the wrong line.
   */
  if (who?.agent) {
    const marker = JSON.stringify({
      agent: who.agent,
      ...(who.operator ? { operator: who.operator } : {}),
      ...(who.harness ? { harness: who.harness } : {}),
    });
    await context.addInitScript((value: string) => {
      try {
        window.localStorage.setItem("ai-rush:arena", value);
      } catch {
        /* Storage blocked. This is why the harness also puts the agent's name
           on the URL: the fallback that matters is the one that stops a
           machine's run being filed as a person's, and losing the marker
           silently would corrupt the exact dataset the Arena exists to
           produce. `arenaUrl()` in `src/arena/url.ts`. */
      }
    }, marker);
  }

  await context.addInitScript(() => {
    /*
     * A no-op `__name`.
     *
     * `extractBoxes` is TypeScript, so it reaches the browser through esbuild,
     * and esbuild's `keepNames` wraps every named function in a `__name(fn,
     * "fn")` helper it expects to find in the module scope. Serialised into a
     * page by `page.evaluate` there is no module scope, and the extractor dies
     * on `ReferenceError: __name is not defined` before it reads a single
     * pixel.
     *
     * The helper only exists to preserve `Function.prototype.name` for stack
     * traces. Nothing here reads a function's name, so identity is a complete
     * implementation.
     */
    const w = globalThis as unknown as { __name?: (fn: unknown) => unknown };
    w.__name ??= (fn) => fn;

    /*
     * An agent has no microphone, camera or accelerometer, so it declines.
     *
     * That is the honest state for a machine rather than a limitation imposed
     * on one: every sensor level has a fallback that is a real level, and the
     * whole suite already runs this way. Answering before load means the run
     * starts on a level instead of on the calibration screen.
     */
    try {
      window.localStorage.setItem("ai-rush:sensors", "declined");
    } catch {
      /* Storage blocked. The screen appears and the agent has to dismiss it,
         which is a fair first puzzle. */
    }
  });
}
