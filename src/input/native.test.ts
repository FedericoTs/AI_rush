import { afterEach, describe, expect, it, vi } from "vitest";
import { registerNative, resetNative } from "./native";
import { createHapticsAdapter } from "./adapters/haptics";
import { createMotionAdapter } from "./adapters/motion";
import type { MotionSample } from "./adapters/types";

/**
 * The Phase 7 acceptance test, written as a test.
 *
 * `ROADMAP.md`: swapping in the native plugins must need "zero changes in
 * `src/levels/`", and that is called the test of whether Phase 1 was done
 * right. What that means concretely is that an adapter's *contract* —
 * subscribe / current / destroy, and the `MotionSample` shape — has to survive
 * the implementation underneath it being replaced.
 *
 * So these register a bridge, take an adapter through the same motions a level
 * would, and assert the level could not tell.
 */

afterEach(() => {
  resetNative();
  vi.unstubAllGlobals();
});

describe("haptics", () => {
  it("prefers the native engine over navigator.vibrate", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const native = vi.fn();
    registerNative({ haptics: { pattern: native } });

    createHapticsAdapter().pattern([200, 100, 200]);

    expect(native).toHaveBeenCalledWith([200, 100, 200]);
    expect(vibrate).not.toHaveBeenCalled();
  });

  /* iOS Safari has no `navigator.vibrate` at all, which is why L26's flash
     path is primary. Inside the app there *is* a haptic engine — so the level
     that was built for the silent path must now report hardware without
     knowing anything changed. */
  it("reports itself available on a platform where the web API does not exist", () => {
    vi.stubGlobal("navigator", {});
    expect(createHapticsAdapter().available).toBe(false);

    registerNative({ haptics: { pattern: () => {} } });
    expect(createHapticsAdapter().available).toBe(true);
  });

  it("falls through to the visual path when the plugin throws", () => {
    vi.stubGlobal("navigator", {});
    registerNative({
      haptics: {
        pattern() {
          throw new Error("plugin missing");
        },
      },
    });

    const silent = vi.fn();
    const h = createHapticsAdapter();
    h.onSilent(silent);
    h.pattern([100]);

    /* A native plugin that throws is a native plugin that is not there. The
       level must still get its flash, or the puzzle becomes unsolvable. */
    expect(silent).toHaveBeenCalledWith([100]);
  });
});

describe("motion", () => {
  it("delivers native samples through the same subscribe/current contract", () => {
    let emit: ((s: MotionSample) => void) | null = null;
    const off = vi.fn();
    registerNative({
      motion: {
        subscribe(cb) {
          emit = cb;
          return off;
        },
      },
    });

    const adapter = createMotionAdapter();
    const seen: MotionSample[] = [];
    const unsubscribe = adapter.subscribe((s) => seen.push(s));

    emit!({ beta: 12, gamma: -4, alpha: 90, magnitude: 9.8 });

    expect(seen).toEqual([{ beta: 12, gamma: -4, alpha: 90, magnitude: 9.8 }]);
    expect(adapter.current()).toEqual({ beta: 12, gamma: -4, alpha: 90, magnitude: 9.8 });

    unsubscribe();
    adapter.destroy();
    expect(off).toHaveBeenCalled();
  });

  it("uses the browser events when no bridge was registered", () => {
    const add = vi.spyOn(window, "addEventListener");
    createMotionAdapter();
    const events = add.mock.calls.map((c) => c[0]);
    expect(events).toContain("deviceorientation");
    expect(events).toContain("devicemotion");
    add.mockRestore();
  });
});
