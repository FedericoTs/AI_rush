/**
 * Seeded randomness.
 *
 * Every random decision in a run — the deal, the modifier schedule, each
 * level's internals, even which slop microcopy appears — comes from here.
 * Two players opening the same seed link must get byte-identical runs, or
 * the challenge mechanic in VIRALITY.md §5 is a lie.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  (): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Uniform integer in [min, max] inclusive. */
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates. Returns a new array; never mutates the input. */
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability p. */
  chance(p: number): boolean;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = next as Rng;
  rng.int = (maxExclusive) => Math.floor(next() * maxExclusive);
  rng.range = (min, max) => min + Math.floor(next() * (max - min + 1));
  rng.pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError("rng.pick on an empty array");
    return items[rng.int(items.length)] as T;
  };
  rng.shuffle = <T,>(items: readonly T[]): T[] => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };
  rng.chance = (p) => next() < p;
  return rng;
}

/** FNV-1a. Used to derive per-level streams from a run seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A level's own stream. Derived from the run seed, so a level's internal
 * randomness is reproducible *and* independent of how many levels preceded
 * it — inserting a level into the deck must not reshuffle the ones after it.
 */
export function streamFor(runSeed: number, levelId: string): Rng {
  return mulberry32((runSeed ^ hashString(levelId)) >>> 0);
}

/* ── seed links ────────────────────────────────────────────────────────
   `8F2A1C-MAC` — the hex seed, then the capability classes that were
   available when it was dealt. A desktop player opening a phone player's
   link gets the same levels in the same order with the degraded variants,
   which is a fair comparison rather than a broken one.
   ──────────────────────────────────────────────────────────────────── */

export const CAPABILITY_MARKS = { motion: "M", audioIn: "A", camera: "C" } as const;
export type CapabilityMark = (typeof CAPABILITY_MARKS)[keyof typeof CAPABILITY_MARKS];

export function encodeSeed(seed: number, marks: readonly CapabilityMark[]): string {
  const ordered = (["M", "A", "C"] as const).filter((m) => marks.includes(m));
  const hex = (seed >>> 0).toString(16).toUpperCase().padStart(6, "0");
  return ordered.length ? `${hex}-${ordered.join("")}` : hex;
}

export function decodeSeed(text: string): { seed: number; marks: CapabilityMark[] } | null {
  const m = /^([0-9A-F]{1,8})(?:-([MAC]{1,3}))?$/i.exec(text.trim());
  if (!m) return null;
  const seed = parseInt(m[1] as string, 16) >>> 0;
  const marks = (m[2] ?? "").toUpperCase().split("").filter((c): c is CapabilityMark =>
    c === "M" || c === "A" || c === "C",
  );
  return { seed, marks };
}
