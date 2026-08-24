import type { BrowserContext } from "playwright";

/**
 * The two things every Arena page needs before it loads.
 *
 * Shared by the MCP server and the probe so they cannot drift — a difference
 * between what the probe shows and what an agent sees would make the probe
 * worse than useless.
 */
export async function prepareContext(context: BrowserContext): Promise<void> {
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
