import type { AsymmetryRow } from "@/lib/db";
import { CATALOG } from "@/levels/catalog";
import type { Tier } from "@/engine/types";

/**
 * The asymmetry table's arithmetic, kept away from the markup so it can be
 * argued with.
 *
 * `AGENT_ARENA.md` §6 calls this "the most genuinely interesting artifact the
 * project produces". Which makes it the one place in this codebase where being
 * *slightly* wrong is worse than showing nothing — a table of confident
 * percentages drawn over four attempts is not an artifact, it is a rumour with
 * a border around it.
 *
 * So two rules, both enforced here rather than remembered by whoever edits the
 * page next:
 *
 *   1. No rate below `MIN_SEEN` attempts. Not a greyed-out one, not a
 *      parenthesised one — null, and the page renders the raw counts instead.
 *   2. No gap unless *both* sides cleared that bar. A gap is a comparison, and
 *      comparing a measurement to an absence produces a number that looks
 *      exactly like a finding.
 */

/**
 * Attempts before a solve rate is drawn at all.
 *
 * Five is not a confidence interval and does not pretend to be. It is the
 * point below which the denominator is visibly doing all the work — at four
 * attempts every possible rate is a multiple of 25% — and the honest rendering
 * is the fraction itself.
 */
export const MIN_SEEN = 5;

export interface Cell {
  seen: number;
  solved: number;
  skipped: number;
  medianMs: number | null;
  /** solved ÷ seen, or null below `MIN_SEEN`. */
  rate: number | null;
}

export interface TableRow {
  levelId: string;
  title: string;
  tier: Tier;
  human: Cell;
  agent: Cell;
  /**
   * Human rate minus agent rate, or null when either side is too thin.
   * Positive: people beat this and machines don't. Negative: the reverse.
   */
  gap: number | null;
}

function cell(seen: number, solved: number, skipped: number, medianMs: number | null): Cell {
  return {
    seen,
    solved,
    skipped,
    medianMs: medianMs ?? null,
    rate: seen >= MIN_SEEN ? solved / seen : null,
  };
}

/**
 * Rows, sorted by how much they have to say.
 *
 * Levels where both sides have played and disagree come first, biggest
 * disagreement at the top — that is the entire point of the table. Then the
 * ones only one side has reached, which are a to-do list rather than a
 * finding. Then catalogue order, which is a fine way to end.
 */
export function buildTable(rows: readonly AsymmetryRow[]): TableRow[] {
  const order = new Map(CATALOG.map((m, i) => [m.id, i]));

  const out: TableRow[] = rows
    .map((r) => {
      const meta = CATALOG.find((m) => m.id === r.level_id);
      /* A level id in the log that is not in the catalogue is a renamed or
         removed level, and its history is not attributable to anything a
         reader could go and play. Dropped rather than shown as "L99". */
      if (!meta) return null;

      const human = cell(r.human_seen, r.human_solved, r.human_skipped, r.human_median_ms);
      const agent = cell(r.agent_seen, r.agent_solved, r.agent_skipped, r.agent_median_ms);

      return {
        levelId: meta.id,
        title: meta.title,
        tier: meta.tier,
        human,
        agent,
        gap: human.rate !== null && agent.rate !== null ? human.rate - agent.rate : null,
      };
    })
    .filter((r): r is TableRow => r !== null);

  return out.sort((a, b) => {
    if (a.gap !== null && b.gap !== null) return Math.abs(b.gap) - Math.abs(a.gap);
    if (a.gap !== null) return -1;
    if (b.gap !== null) return 1;
    return (order.get(a.levelId) ?? 0) - (order.get(b.levelId) ?? 0);
  });
}

/** Whether anything on this table is a comparison yet. */
export function hasComparison(rows: readonly TableRow[]): boolean {
  return rows.some((r) => r.gap !== null);
}

export function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function seconds(ms: number | null): string {
  if (ms === null) return "—";
  return ms >= 10_000 ? `${Math.round(ms / 1000)}s` : `${(ms / 1000).toFixed(1)}s`;
}
