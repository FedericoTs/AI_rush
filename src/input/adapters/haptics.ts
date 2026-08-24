import { nativeBridge } from "../native";

/**
 * Haptics, and what to do without them.
 *
 * `navigator.vibrate` does not exist on any iOS Safari, so for L26 the
 * flash-and-audio path is the *majority* path, not a fallback. It is built
 * first and treated as primary; real vibration is the bonus.
 *
 * Inside a native shell there is a third option, and it is the good one: iOS
 * has had a haptic engine the whole time, the web just cannot reach it. When
 * `src/native/` has registered a bridge this uses it — which is the entire
 * Capacitor swap for this capability, and it happens without a single line
 * changing in the level that consumes it.
 */
export interface HapticsHandle {
  readonly available: boolean;
  pattern(ms: readonly number[]): void;
  /** Fires when a pattern plays without hardware, so the level can flash instead. */
  onSilent(cb: (pattern: readonly number[]) => void): () => void;
}

export function createHapticsAdapter(): HapticsHandle {
  const native = nativeBridge().haptics ?? null;
  const web = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const subs = new Set<(p: readonly number[]) => void>();

  return {
    available: Boolean(native) || web,
    pattern(ms) {
      if (native) {
        try {
          native.pattern(ms);
          return;
        } catch {
          /* A native plugin that threw is a native plugin that is not there.
             Fall through rather than leaving the level with no feedback. */
        }
      }
      if (web) {
        try {
          navigator.vibrate(ms as number[]);
          return;
        } catch {
          /* fall through to the visual path */
        }
      }
      for (const cb of subs) cb(ms);
    },
    onSilent: (cb) => (subs.add(cb), () => subs.delete(cb)),
  };
}
