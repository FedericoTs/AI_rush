import type { MotionSample } from "./adapters/types";

/**
 * The seam a native shell plugs into.
 *
 * `ROADMAP.md` Phase 7 says the Capacitor swap must need **zero changes in
 * `src/levels/`**, and calls that the acceptance test for whether Phase 1 was
 * done right. This file is what makes it true, and it is deliberately tiny.
 *
 * ── Why a registry and not an import ─────────────────────────────────────
 *
 * The obvious version is `import { Haptics } from "@capacitor/haptics"` inside
 * the adapter, guarded by `Capacitor.isNativePlatform()`. That drags two
 * native-only packages into the web bundle for a branch that is false in every
 * browser, and it makes the web build fail to install if either package is
 * missing — which is a strange thing for a website to depend on.
 *
 * So the dependency points the other way. The web build knows nothing about
 * Capacitor; the native entry point (`src/native/index.ts`, which only the
 * native build loads) imports the plugins and calls `registerNative()` before
 * React mounts. Adapters ask this module whether anything better than the
 * browser is available.
 *
 * The consequence worth having: `src/levels/**` cannot tell the difference,
 * has no import that would let it try, and the ESLint sandbox on that
 * directory stays exactly as strict as it was.
 */

export interface NativeHaptics {
  /** Milliseconds on/off, the same shape `navigator.vibrate` takes. */
  pattern(ms: readonly number[]): void;
}

export interface NativeMotion {
  /** Returns an unsubscribe. Samples are already in the engine's units. */
  subscribe(cb: (sample: MotionSample) => void): () => void;
}

export interface NativeBridge {
  haptics?: NativeHaptics;
  motion?: NativeMotion;
}

let bridge: NativeBridge = {};

/**
 * Called once by the native entry point, before the app mounts.
 *
 * Merges rather than replaces, so a shell can register what it has and leave
 * the rest to the browser implementations — a desktop Electron build with real
 * haptics and no accelerometer is a perfectly coherent thing to be.
 */
export function registerNative(next: NativeBridge): void {
  bridge = { ...bridge, ...next };
}

export function nativeBridge(): NativeBridge {
  return bridge;
}

/** Test-only. Nothing in the app clears the bridge once it is set. */
export function resetNative(): void {
  bridge = {};
}
