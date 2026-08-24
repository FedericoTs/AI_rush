/**
 * Scripted adapters.
 *
 * Playwright cannot shake a phone, scream into a microphone, or blink. These
 * replay recorded traces through the same interface the real adapters expose,
 * which is the entire reason the adapter seam exists (ARCHITECTURE.md §4).
 */

import type { Adapter } from "../adapters/types";
import type { AudioSample, CameraSample, MotionSample, PointerSample } from "../adapters/types";

export interface Trace<T> {
  /** [ms since start, sample] pairs, ascending. */
  frames: ReadonlyArray<readonly [number, T]>;
}

/** Replays a trace under manual time control — no timers, no rAF, no flake. */
export function createScriptedAdapter<T>(trace: Trace<T>, initial: T): Adapter<T> & {
  seek(ms: number): void;
} {
  const subs = new Set<(v: T) => void>();
  let last = initial;

  return {
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
    current: () => last,
    seek(ms) {
      for (const [at, sample] of trace.frames) {
        if (at > ms) break;
        last = sample;
      }
      for (const cb of subs) cb(last);
    },
    destroy: () => subs.clear(),
  };
}

/* ── traces worth keeping around ─────────────────────────────────────── */

/** A deliberate, controlled tilt — the way "Confirm With A Gesture" is beaten. */
export const STEADY_TILT: Trace<MotionSample> = {
  frames: Array.from({ length: 40 }, (_, i) => [
    i * 50,
    { beta: Math.min(18, i * 0.6), gamma: 0, alpha: 0, magnitude: 9.8 },
  ] as const),
};

/** Someone actually standing up and turning around. Peaks well past gravity. */
export const STAND_AND_TURN: Trace<MotionSample> = {
  frames: Array.from({ length: 60 }, (_, i) => [
    i * 50,
    { beta: 0, gamma: 0, alpha: (i * 6) % 360, magnitude: i > 10 && i < 45 ? 14 + (i % 5) : 9.8 },
  ] as const),
};

/** A steady hum inside the safe band, held long enough to pass. */
export const STEADY_HUM: Trace<AudioSample> = {
  frames: Array.from({ length: 60 }, (_, i) => [i * 50, { rms: i < 6 ? i * 0.1 : 0.7 }] as const),
};

/** Seven brightness deltas — a finger over the lens works exactly as well. */
export const SEVEN_BLINKS: Trace<CameraSample> = {
  frames: Array.from({ length: 70 }, (_, i) => [
    i * 100,
    { brightness: i % 10 < 2 ? 0.1 : 0.6 },
  ] as const),
};

export const TAP: Trace<PointerSample> = {
  frames: [
    [0, { x: 100, y: 100, id: 1, phase: "down", count: 1 }],
    [80, { x: 100, y: 100, id: 1, phase: "up", count: 0 }],
  ],
};
