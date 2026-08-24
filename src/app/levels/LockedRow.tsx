"use client";

import Link from "next/link";
import type { LevelMeta } from "@/engine/types";
import { isUnlocked } from "@/engine/unlocks";
import { useUnlocks } from "@/lib/unlockStore";
import s from "./levels.module.css";

/**
 * A row in the index that might be locked.
 *
 * Locked levels are listed rather than hidden, because a catalogue with holes
 * in it is how you find out something exists — and a lock nobody can see is
 * not a lock, it is an absence. What stays hidden is the same thing that stays
 * hidden for every other level: what it actually does.
 *
 * Client-side because unlock state lives in this browser. The row renders in
 * its locked shape first and fills in after mount, which is correct: the
 * server has no idea what you have opened and guessing would be a hydration
 * mismatch on the busiest page in the game.
 */
export function LockedRow({ meta, children }: { meta: LevelMeta; children: React.ReactNode }) {
  const mine = useUnlocks();
  const open = isUnlocked(meta, { credits: mine.credits, secret: mine.secret });

  if (open) {
    return (
      <Link className={s.item} href={`/levels/${meta.id}`} data-level-id={meta.id}>
        {children}
      </Link>
    );
  }

  const how =
    meta.unlock?.kind === "secret"
      ? "Somewhere in this game there is a link that does not look like one."
      : `Get ${meta.unlock?.credits === 1 ? "one person" : `${meta.unlock?.credits} people`} to play a run from your link.`;

  return (
    <div className={`${s.item} ${s.locked}`} data-level-id={meta.id} data-locked="yes" title={how}>
      {children}
      <span className={s.lockNote}>{how}</span>
    </div>
  );
}
