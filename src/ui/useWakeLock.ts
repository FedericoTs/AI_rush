"use client";

import { useEffect } from "react";

/**
 * Keep the screen on while the clock is running.
 *
 * This is a Phase 7 exit criterion and it is not cosmetic. Several levels have
 * long stretches with no touch at all — L22 is a progress bar you watch, L35
 * asks you to stand up, L14 wants you to talk — and a phone that dims and
 * locks at thirty seconds of "inactivity" turns those into a lost run. The
 * clock does not stop for a lock screen.
 *
 * Two things make this fiddly, and both are handled:
 *
 * 1. **The lock is released when the tab is hidden**, by the platform, and it
 *    is not restored on its own. So it is re-acquired on `visibilitychange` —
 *    without which a single notification pull-down permanently un-does it.
 * 2. **`request()` rejects** on an unsupported browser (every iOS before 16.4),
 *    in a background tab, and on low battery. All of those are fine and none of
 *    them are worth telling the player about; the game is fully playable on a
 *    screen that dims, it is just worse.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        /* Released by the platform on hide, on low battery, or by the user's
           settings. Dropping the reference keeps `acquire` from thinking it
           still holds one. */
        sentinel.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        /* Unsupported, backgrounded, or refused. The run continues. */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && !sentinel) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
