/**
 * Every input reaches a level through an adapter.
 *
 * Three reasons this seam exists, in order of how much they cost to add later:
 *   1. Playwright cannot shake a phone. Adapters swap for scripted traces.
 *   2. The deck must know what the device can do *before* it deals.
 *   3. The Capacitor port replaces web adapters with native plugins here,
 *      and no level code changes. That swap is the acceptance test for
 *      whether Phase 1 was built right (ROADMAP.md Phase 7).
 */

export interface Adapter<T> {
  subscribe(cb: (value: T) => void): () => void;
  /** Latest value, for levels that poll inside a frame loop. */
  current(): T;
  destroy(): void;
}

export interface PointerSample {
  x: number;
  y: number;
  id: number;
  phase: "down" | "move" | "up";
  /** Concurrent pointers, for the multi-touch levels. */
  count: number;
}

export interface MotionSample {
  /** Front-to-back tilt, degrees. */
  beta: number;
  /** Left-to-right tilt, degrees. */
  gamma: number;
  /** Compass heading, degrees. */
  alpha: number;
  /** Total acceleration magnitude, m/s². Used by "Please Stand Up". */
  magnitude: number;
}

export interface AudioSample {
  /** Smoothed RMS, 0..1. */
  rms: number;
}

export interface CameraSample {
  /** Mean frame brightness, 0..1. Blink counting is a delta on this. */
  brightness: number;
}

export interface KeySample {
  key: string;
  code: string;
  phase: "down" | "up";
}
