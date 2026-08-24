/**
 * Scoring. Pure, dependency-free, and shared verbatim with the server.
 *
 * The client's score is advisory. /api/run/finish recomputes with these same
 * functions from the append-only event log, and the leaderboard stores that
 * number (BACKEND.md §4). Anything stateful in here breaks that guarantee.
 */

import type { Tier } from "./types";

export const TIER_BASE: Record<Tier, number> = {
  annoying: 100,
  cursed: 250,
  unhinged: 500,
  forbidden: 1000,
};

/** [consecutive solves required, multiplier], highest first. */
export const COMBO_LADDER: ReadonlyArray<readonly [number, number]> = [
  [8, 3], [5, 2], [3, 1.5], [2, 1.2], [1, 1],
];

export const RUN_DURATION_MS = 5 * 60 * 1000;
export const SKIP_PENALTY_MS = 10_000;
export const FIRST_TRY_BONUS = 100;
/** Speed can add at most half a level's base. */
export const SPEED_BONUS_SHARE = 0.5;

export function comboFor(streak: number): number {
  for (const [need, mult] of COMBO_LADDER) if (streak >= need) return mult;
  return 1;
}

export interface LevelScoreInput {
  tier: Tier;
  parSeconds: number;
  solveMs: number;
  /** Failed attempts before the solve. Fails cost no clock time, only the bonus. */
  fails: number;
  combo: number;
}

export interface LevelScore {
  base: number;
  speed: number;
  firstTry: number;
  combo: number;
  total: number;
}

export function scoreLevel(input: LevelScoreInput): LevelScore {
  const base = TIER_BASE[input.tier];
  const parMs = input.parSeconds * 1000;
  const fraction = parMs > 0 ? Math.max(0, 1 - input.solveMs / parMs) : 0;
  const speed = Math.floor(base * fraction * SPEED_BONUS_SHARE);
  const firstTry = input.fails === 0 ? FIRST_TRY_BONUS : 0;
  return {
    base,
    speed,
    firstTry,
    combo: input.combo,
    total: Math.round((base + speed + firstTry) * input.combo),
  };
}

/* ── server-side recompute ─────────────────────────────────────────── */

export type RunEventKind = "enter" | "solve" | "fail" | "skip";

export interface RunEvent {
  seq: number;
  kind: RunEventKind;
  levelId: string;
  /** ms since run start. */
  atMs: number;
  solveMs?: number;
}

export interface DeckEntry {
  levelId: string;
  tier: Tier;
  parSeconds: number;
}

export interface RunTotals {
  score: number;
  solved: number;
  skipped: number;
  bestCombo: number;
  perLevel: Array<{ levelId: string; points: number; combo: number }>;
}

/**
 * Recompute a run's score from its event log. This is the number that reaches
 * the leaderboard; whatever the client reported is ignored.
 */
export function scoreRun(events: readonly RunEvent[], deck: readonly DeckEntry[]): RunTotals {
  const byId = new Map(deck.map((d) => [d.levelId, d]));
  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  let score = 0, solved = 0, skipped = 0, streak = 0, bestCombo = 1;
  let fails = 0;
  const perLevel: RunTotals["perLevel"] = [];

  for (const ev of ordered) {
    switch (ev.kind) {
      case "enter":
        fails = 0;
        break;
      case "fail":
        fails++;
        break;
      case "skip":
        skipped++;
        streak = 0;
        fails = 0;
        break;
      case "solve": {
        const entry = byId.get(ev.levelId);
        if (!entry) break; // deck mismatch; validateRun rejects the run separately
        streak++;
        const combo = comboFor(streak);
        if (combo > bestCombo) bestCombo = combo;
        const s = scoreLevel({
          tier: entry.tier,
          parSeconds: entry.parSeconds,
          solveMs: ev.solveMs ?? entry.parSeconds * 1000,
          fails,
          combo,
        });
        score += s.total;
        solved++;
        fails = 0;
        perLevel.push({ levelId: ev.levelId, points: s.total, combo });
        break;
      }
    }
  }

  return { score, solved, skipped, bestCombo, perLevel };
}

/* ── plausibility checks (BACKEND.md §4) ───────────────────────────── */

export type RejectionReason =
  | "clock_overrun" | "impossible_speed" | "too_many_levels"
  | "deck_mismatch" | "event_integrity";

/** Theoretical ceiling in five minutes, given the shortest par in the catalog. */
export const MAX_LEVELS_PER_RUN = 14;
export const CLOCK_GRACE_MS = 15_000;
/** Below this, a level with a meaningful par probably was not actually played. */
export const MIN_PLAUSIBLE_SOLVE_MS = 300;

/**
 * How many suspiciously fast solves a run is allowed before it is thrown out.
 *
 * This used to be zero, and it cost a real player a real run: twelve levels
 * solved in three minutes and forty-nine seconds, filed as a score of nought,
 * because one of the twelve — L27, whose honest solve is "click the field,
 * take the first suggestion" — was beaten in two clicks by someone who already
 * knew the trick. One fast solve is what learning a level looks like. It is
 * not evidence of anything.
 *
 * The check still earns its place against a log of fourteen instant solves, so
 * it stays; it just needs a pattern rather than a single data point. The real
 * defences against a forged log are elsewhere and unaffected: the score is
 * recomputed here from the events, and `submit_run` caps it at solves × 4,800
 * whatever this function decides.
 */
export const MAX_IMPLAUSIBLE_SOLVES = 2;

export function validateRun(
  events: readonly RunEvent[],
  deck: readonly DeckEntry[],
  durationMs: number,
): RejectionReason | null {
  if (durationMs > RUN_DURATION_MS + CLOCK_GRACE_MS) return "clock_overrun";

  const ids = new Set(deck.map((d) => d.levelId));
  const seen = new Set<number>();
  const solvedIds = new Set<string>();
  let implausible = 0;

  for (const ev of events) {
    if (seen.has(ev.seq)) return "event_integrity";
    seen.add(ev.seq);
    if (!ids.has(ev.levelId)) return "deck_mismatch";
    if (ev.kind === "solve") {
      if (solvedIds.has(ev.levelId)) return "event_integrity";
      solvedIds.add(ev.levelId);
      const entry = deck.find((d) => d.levelId === ev.levelId);
      if (entry && entry.parSeconds > 5 && (ev.solveMs ?? 0) < MIN_PLAUSIBLE_SOLVE_MS) {
        implausible++;
      }
    }
  }

  /* A pattern, not a single data point — see MAX_IMPLAUSIBLE_SOLVES. */
  if (implausible > MAX_IMPLAUSIBLE_SOLVES) return "impossible_speed";
  if (solvedIds.size > MAX_LEVELS_PER_RUN) return "too_many_levels";

  const seqs = [...seen].sort((a, b) => a - b);
  for (let i = 0; i < seqs.length; i++) if (seqs[i] !== i + 1) return "event_integrity";

  return null;
}
