import { nativeBridge } from "../native";
import type { Adapter, MotionSample } from "./types";

const ZERO: MotionSample = { beta: 0, gamma: 0, alpha: 0, magnitude: 0 };

/**
 * Tilt and shake.
 *
 * In a browser this is `deviceorientation` + `devicemotion`, which need a
 * permission prompt on iOS and are throttled to 60Hz at best. A native shell
 * registers a bridge instead (`src/input/native.ts`) and this uses that — same
 * `MotionSample`, same subscribe/current/destroy contract, so nothing
 * downstream and nothing in `src/levels/**` can tell which one it got.
 */
export function createMotionAdapter(): Adapter<MotionSample> {
  const subs = new Set<(v: MotionSample) => void>();
  let last: MotionSample = ZERO;

  const push = (next: MotionSample) => {
    last = next;
    for (const cb of subs) cb(next);
  };

  const native = nativeBridge().motion;
  if (native) {
    const off = native.subscribe(push);
    return {
      subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
      current: () => last,
      destroy() {
        off();
        subs.clear();
      },
    };
  }

  const onOrient = (e: Event) => {
    const ev = e as DeviceOrientationEvent;
    push({ ...last, beta: ev.beta ?? 0, gamma: ev.gamma ?? 0, alpha: ev.alpha ?? 0 });
  };

  const onMotion = (e: Event) => {
    const a = (e as DeviceMotionEvent).accelerationIncludingGravity;
    if (!a) return;
    const magnitude = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
    push({ ...last, magnitude });
  };

  if (typeof window !== "undefined") {
    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("devicemotion", onMotion);
  }

  return {
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
    current: () => last,
    destroy() {
      if (typeof window !== "undefined") {
        window.removeEventListener("deviceorientation", onOrient);
        window.removeEventListener("devicemotion", onMotion);
      }
      subs.clear();
    },
  };
}
