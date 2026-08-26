/**
 * The three numbers on the front page, and how to read them safely.
 *
 * Pure, and deliberately in its own module rather than in `db.ts`: that one
 * imports `server-only`, and a function whose whole job is to be defensive
 * about untrusted shapes should be reachable by a test.
 */
export interface LiveStats {
  playingNow: number;
  /** Runs that reached the end or left mid-run and said so — `0011_runs_played.sql`. */
  runs: number;
  players: number;
  topScore: number;
}

export const NO_STATS: LiveStats = { playingNow: 0, runs: 0, players: 0, topScore: 0 };

/**
 * Read whatever `live_stats` returned, across a version boundary.
 *
 * The app and the database are deployed by different mechanisms minutes
 * apart, so for a short window one of them is older than the other. A missing
 * key here used to mean `undefined.toLocaleString()` — a blank landing page,
 * brought down by a counter. Every field is coerced, so a stale schema on
 * either side costs a zero rather than the page.
 */
export function toLiveStats(raw: unknown): LiveStats {
  const r = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    playingNow: n(r.playingNow),
    /* `runsToday` is the old key, accepted while a deployment settles. */
    runs: n(r.runs ?? r.runsToday),
    players: n(r.players),
    topScore: n(r.topScore),
  };
}
