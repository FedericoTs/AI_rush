/**
 * The native entry point.
 *
 * **This file is not part of the web build.** Nothing in `src/app/` imports it,
 * and the `@capacitor/*` packages it names are not dependencies of this
 * project — the website must not need a native SDK installed to run. It is
 * loaded by the Capacitor shell (see `docs/MOBILE.md`), which does have them.
 *
 * Its whole job is to fill in `src/input/native.ts` before React mounts, so
 * that every adapter downstream quietly gets the better implementation. That
 * is the Phase 7 acceptance test from `ROADMAP.md`:
 *
 *   > swap in `@capacitor/haptics` and `@capacitor/motion` at the adapter seam
 *   > — **zero changes in `src/levels/`** (this is the test of whether Phase 1
 *   > was done right)
 *
 * There are no changes in `src/levels/`. There are no changes in any level's
 * props, in `useInput`, or in the engine. The two adapters ask a registry
 * whether something better turned up, and this is what turns up.
 *
 * @example
 *   // capacitor entry, loaded before the app bundle
 *   import { installNativeBridge } from "@/native";
 *   await installNativeBridge();
 */

import { registerNative } from "@/input/native";
import type { MotionSample } from "@/input/adapters/types";
import type { HapticsPlugin } from "@capacitor/haptics";

/**
 * Play a pattern on a plugin that only knows how to buzz for N milliseconds.
 *
 * `navigator.vibrate` takes on/off/on/off; Capacitor's Haptics takes one
 * duration. Rather than pretend, this walks the pattern with timers — which is
 * exactly what L26 needs, because the level's mechanic is the *rhythm* rather
 * than the buzz, and a single long vibration would destroy the puzzle.
 */
function playPattern(haptics: HapticsPlugin, ms: readonly number[]): void {
  let at = 0;
  ms.forEach((duration, i) => {
    /* Even indices are "on", odd are the gaps between. */
    if (i % 2 === 0 && duration > 0) {
      setTimeout(() => void haptics.vibrate({ duration }).catch(() => {}), at);
    }
    at += duration;
  });
}

export async function installNativeBridge(): Promise<void> {
  const [{ Haptics }, { Motion }] = await Promise.all([
    import("@capacitor/haptics"),
    import("@capacitor/motion"),
  ]);

  registerNative({
    haptics: {
      pattern: (ms) => playPattern(Haptics, ms),
    },

    motion: {
      subscribe(cb) {
        let sample: MotionSample = { beta: 0, gamma: 0, alpha: 0, magnitude: 0 };
        const removers: Array<() => void> = [];

        const push = (next: Partial<MotionSample>) => {
          sample = { ...sample, ...next };
          cb(sample);
        };

        void Motion.addListener("accel", (e) => {
          const a = e.accelerationIncludingGravity;
          push({ magnitude: Math.hypot(a.x, a.y, a.z) });
        }).then((h) => removers.push(() => void h.remove()));

        void Motion.addListener("orientation", (e) => {
          push({ alpha: e.alpha, beta: e.beta, gamma: e.gamma });
        }).then((h) => removers.push(() => void h.remove()));

        return () => {
          for (const remove of removers) remove();
          removers.length = 0;
        };
      },
    },
  });
}
