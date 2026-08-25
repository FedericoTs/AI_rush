/** Milliseconds in a day. The round rolls over at UTC midnight. */
const DAY_MS = 86_400_000;

/**
 * Which round today is.
 *
 * Pure and separate from the clock so the rollover can be tested without
 * pretending to be a different day.
 */
export function dayNumber(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS);
}

/**
 * Today's round, read from the clock.
 *
 * Impure on purpose, and outside any component on purpose. The page is
 * `force-dynamic`, so this is read once per request and is stable for the
 * whole render — which is exactly the property `react-hooks/purity` exists to
 * protect, and exactly why the read belongs here rather than in a render body
 * with the rule switched off around it.
 */
export async function todaysRound(): Promise<number> {
  return dayNumber(Date.now());
}
