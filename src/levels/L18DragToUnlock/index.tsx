"use client";

import { useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const COLS = 12;
const ROWS = 5;

/**
 * The track, as [col, row] cells. Hand-authored rather than generated so the
 * difficulty is the same for everyone, and it ends on a 180° hairpin — the
 * one corner that actually catches people.
 */
const PATH: ReadonlyArray<readonly [number, number]> = [
  [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3],
  [4, 4], [5, 4], [6, 4], [6, 3], [6, 2], [7, 2], [8, 2], [8, 1], [8, 0], [9, 0],
  [10, 0], [10, 1], [10, 2], [9, 2], [9, 3], [10, 3], [11, 3],
];

/**
 * Slide to unlock, except the track is a maze and leaving it puts you back at
 * the start.
 *
 * The cells are forgiving by a few pixels, deliberately: the hairpin at the end
 * has to be beatable, and a level that is unwinnable by a hair is not cruel,
 * it is broken. Keyboard players step one cell at a time along the path, which
 * is slower and cannot slip.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [reached, setReached] = useState(0);
  const [slipped, setSlipped] = useState(false);
  const [sub] = useState(() => slopSubhead(rng));
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  /*
   * How far along the path we are, as a ref rather than as state.
   *
   * `reached` is state, so it is stale for every pointermove that lands
   * before React re-renders — and a drag delivers several per frame. Two of
   * them arriving on the last cell both saw the old value, both passed the
   * `here > reached` test, and both called `onSolve()`. The store used to
   * award the second one to the *next* level in the deck; it no longer does,
   * but the honest fix is not to send it. Every 0ms and 1ms solve in
   * production followed a solve of this level.
   */
  const far = useRef(0);

  const cellW = 100 / COLS;
  const cellH = 100 / ROWS;

  const reset = () => {
    far.current = 0;
    setReached(0);
    setSlipped(true);
    dragging.current = false;
    onFail("left-the-track");
    sfx.fail();
  };

  const advanceTo = (index: number) => {
    if (index <= far.current) return;
    far.current = index;
    setSlipped(false);
    setReached(index);
    if (index === PATH.length - 1) {
      sfx.pick(3);
      onSolve();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();

    const r = box.getBoundingClientRect();
    /* A few pixels of slack. The hairpin has to be survivable. */
    const col = Math.floor(((e.clientX - r.left) / r.width) * COLS);
    const row = Math.floor(((e.clientY - r.top) / r.height) * ROWS);

    const here = PATH.findIndex(([c, rr]) => c === col && rr === row);
    if (here === -1) return reset();

    /* No teleporting across the maze where the path doubles back on itself. */
    if (Math.abs(here - far.current) > 1) return;
    if (here > far.current) advanceTo(here);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = far.current + (e.key === "ArrowRight" ? 1 : -1);
    if (next < 0 || next >= PATH.length) return;
    sfx.click();
    /* Backwards is a legal move on the keyboard and `advanceTo` only ever goes
       forwards, so stepping back is its own small update. */
    if (next < far.current) {
      far.current = next;
      setReached(next);
      return;
    }
    advanceTo(next);
  };

  const at = PATH[reached]!;

  return (
    <SlopCard>
      <SlopBadge>Verification · Zero-Trust</SlopBadge>
      <SlopHeading>Drag To Unlock 🔓</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div
        className={s.maze}
        ref={boxRef}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {PATH.map(([c, r], i) => (
          <div
            key={`${c}-${r}`}
            className={`${s.cell} ${i < reached ? s.done : ""} ${i === PATH.length - 1 ? s.goal : ""}`}
            style={{
              left: `${c * cellW}%`,
              top: `${r * cellH}%`,
              width: `${cellW}%`,
              height: `${cellH}%`,
            }}
          />
        ))}

        <div
          className={s.handle}
          role="slider"
          tabIndex={0}
          aria-label="Drag to unlock"
          aria-valuenow={reached}
          aria-valuemin={0}
          aria-valuemax={PATH.length - 1}
          style={{
            left: `${at[0] * cellW}%`,
            top: `${at[1] * cellH}%`,
            width: `${cellW}%`,
            height: `${cellH}%`,
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragging.current = true;
            sfx.click();
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => (dragging.current = false)}
          onKeyDown={onKeyDown}
        >
          →
        </div>
      </div>

      <div className={s.progress}>
        <span>{Math.round((reached / (PATH.length - 1)) * 100)}% unlocked</span>
        {slipped && <span className={s.slipped}>left the track — back to the start</span>}
      </div>

      <SlopHint>
        Slide the handle to the end to continue. Keep the handle on the track at all times. 🛤️
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L18: LevelModule = { meta, Component };
