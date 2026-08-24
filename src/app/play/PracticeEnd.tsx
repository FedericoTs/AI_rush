"use client";

import Link from "next/link";
import { formatClock } from "@/engine/clock";
import { ALL_LEVEL_IDS, META_BY_ID } from "@/levels/catalog";
import type { LevelResult } from "@/engine/types";
import s from "./endgame.module.css";

export interface PracticeEndProps {
  breakdown: LevelResult[];
  elapsed: number;
  /** The selection that was played, so "run it again" comes back to the same room. */
  ids: readonly string[];
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/**
 * The end of a practice run.
 *
 * Deliberately not the Endgame. That screen exists to get a handle onto a
 * leaderboard, and none of it applies here: there is no score to claim, no
 * rank to slam into, and nothing to post to X. Practice is a training room —
 * what it owes you is your time against par, level by level, and a fast way
 * back in.
 *
 * Points are not shown at all. A practice score would be a number nobody can
 * compare to anything, and putting one here would only invite the question of
 * why it is not on the board.
 */
export function PracticeEnd({ breakdown, elapsed, ids }: PracticeEndProps) {
  const solved = breakdown.filter((b) => !b.skipped);
  /* Deliberately without the seed: another go at a level you just lost to
     should deal you a different one of it, not a replay of the attempt you
     have already learned. */
  const again =
    ids.length === ALL_LEVEL_IDS.length ? "/levels/all" : `/levels/${ids.join(",")}`;

  return (
    <div className={s.wrap}>
      <div className={s.stamp}>PRACTICE</div>
      <div className={s.score} data-testid="final-score">
        {solved.length}/{breakdown.length}
      </div>
      <div className={s.verdict}>
        {breakdown.length === 0
          ? "Nothing played."
          : solved.length === breakdown.length
            ? "Every one of them. Now do it with the clock on."
            : "Nothing here counts. That is the point of the room."}
      </div>

      <div className={s.rows}>
        {breakdown.map((b, i) => {
          const par = META_BY_ID.get(b.id)?.parSeconds ?? 0;
          const underPar = !b.skipped && par > 0 && b.solveMs <= par * 1000;
          return (
            <div key={`${b.id}-${i}`} className={s.row}>
              <span>
                {b.id} · {b.title}
              </span>
              <span className={underPar ? s.underPar : undefined}>
                {b.skipped
                  ? "skipped"
                  : `${seconds(b.solveMs)} · par ${par}s${b.fails > 0 ? ` · ${b.fails} fail${b.fails > 1 ? "s" : ""}` : ""}`}
              </span>
            </div>
          );
        })}
        <div className={s.row}>
          <span>Time in the room</span>
          <span>{formatClock(elapsed)}</span>
        </div>
      </div>

      <div className={s.actions}>
        <a className={s.primary} href={again}>
          Run it again
        </a>
        <Link className={s.secondary} href="/levels">
          Pick another level
        </Link>
        <a className={s.secondary} href="/play">
          Enough practice — five minutes, for real
        </a>
      </div>
    </div>
  );
}
