"use client";

import Link from "next/link";
import type { LevelMeta } from "@/engine/types";
import { isUnlocked } from "@/engine/unlocks";
import { useUnlocks } from "@/lib/unlockStore";
import s from "./page.module.css";

/**
 * One specimen on the front page sheet.
 *
 * Locked levels stay pinned to the board rather than being cut out of it. A
 * gap where a level should be tells you nothing; a tile you cannot open tells
 * you there is something there and roughly how to get it, which is the entire
 * point of putting the sheet on the front page.
 */
export function SheetTile({ meta }: { meta: LevelMeta }) {
  const mine = useUnlocks();
  const open = isUnlocked(meta, { credits: mine.credits, secret: mine.secret });

  const body = (
    <>
      <span className={s.tileId}>{open ? meta.id : "???"}</span>
      <span className={s.tileTitle}>{open ? meta.title : "Locked"}</span>
      <span className={s.tileParodies}>
        {open
          ? meta.parodies
          : meta.unlock?.kind === "secret"
            ? "Not for sale. Found."
            : `${meta.unlock?.credits} to open`}
      </span>
    </>
  );

  if (!open) {
    return (
      <div className={s.lockedTile} data-home-level={meta.id} data-locked="yes">
        {body}
      </div>
    );
  }

  return (
    <Link className={s.tile} href={`/levels/${meta.id}`} data-tier={meta.tier} data-home-level={meta.id}>
      {body}
    </Link>
  );
}
