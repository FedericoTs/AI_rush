/**
 * Haptics, and what to do without them.
 *
 * `navigator.vibrate` does not exist on any iOS Safari, so for L26 the
 * flash-and-audio path is the *majority* path, not a fallback. It is built
 * first and treated as primary; real vibration is the bonus.
 */
export interface HapticsHandle {
  readonly available: boolean;
  pattern(ms: readonly number[]): void;
  /** Fires when a pattern plays without hardware, so the level can flash instead. */
  onSilent(cb: (pattern: readonly number[]) => void): () => void;
}

export function createHapticsAdapter(): HapticsHandle {
  const available =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const subs = new Set<(p: readonly number[]) => void>();

  return {
    available,
    pattern(ms) {
      if (available) {
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
