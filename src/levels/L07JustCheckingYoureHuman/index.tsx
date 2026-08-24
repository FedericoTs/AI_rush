"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const SHUFFLE_MS = 800;
/** Held this long and the shuffle stops. Undocumented, discoverable. */
const HOLD_MS = 500;

const WANTED = "🚦";
const DECOYS = ["🚌", "🛵", "🏬", "🌳", "🚧", "🛑", "🚕", "🏍️"] as const;

/** Cell contents for one round: `n` cells, `count` of them the target. */
export function board(n: number, count: number, rng: { int(m: number): number; shuffle<T>(a: readonly T[]): T[] }) {
  const cells = Array.from({ length: n }, (_, i) =>
    i < count ? WANTED : DECOYS[rng.int(DECOYS.length)]!,
  );
  return rng.shuffle(cells);
}

/**
 * A CAPTCHA whose tiles will not hold still.
 *
 * Three by three. The images swap positions every 800ms, and your selections
 * stay bound to **cells**, not to images — so a correct answer becomes a wrong
 * one while you are reaching for the next square.
 *
 * The honest solve is that selections are validated on submit against whatever
 * the cells currently hold, so you can simply wait for a shuffle to land
 * favourably and commit. And there is a second, better route: press and hold
 * anywhere on the grid and the shuffle stops. Nothing says so.
 *
 * Getting it wrong does not end anything — it hands you a fresh grid, this time
 * four by four, which is the correct amount of punishment for a level worth a
 * hundred points.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [size, setSize] = useState(3);
  const [cells, setCells] = useState<string[]>(() => board(9, 3, rng));
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const [held, setHeld] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (held) return;
    const id = setInterval(() => setCells((c) => rng.shuffle(c)), SHUFFLE_MS);
    return () => clearInterval(id);
  }, [held, rng, size]);

  const startHold = () => {
    hold.current = setTimeout(() => setHeld(true), HOLD_MS);
  };
  const endHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };

  const toggle = (i: number) => {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
    sfx.blip();
  };

  const verify = () => {
    const chosen = [...picked];
    const right =
      chosen.length > 0 &&
      chosen.every((i) => cells[i] === WANTED) &&
      cells.filter((c) => c === WANTED).length === chosen.length;

    if (right) {
      onSolve();
      return;
    }
    /* A fresh grid, one size larger. Cruel, cheap, and never a dead end. */
    const nextSize = size === 3 ? 4 : 3;
    setSize(nextSize);
    setCells(board(nextSize * nextSize, nextSize, rng));
    setPicked(new Set());
    setHeld(false);
    setError("Let's try another one!");
    onFail("wrong-captcha");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Security · Trusted by Teams</SlopBadge>
      <SlopHeading>Just Checking You&apos;re Human 🤖</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <p className={s.ask}>Select all squares with <b>traffic lights</b>.</p>

      <div
        className={s.grid}
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        data-testid="captcha-grid"
        data-held={held ? "yes" : "no"}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
      >
        {cells.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`${s.cell} ${picked.has(i) ? s.on : ""}`}
            onClick={() => toggle(i)}
            data-testid={`cell-${i}`}
            aria-pressed={picked.has(i)}
            aria-label={`Square ${i + 1}`}
          >
            <span>{c}</span>
          </button>
        ))}
      </div>

      <SlopCta onClick={verify}>Verify</SlopCta>
      <SlopError>{error}</SlopError>
      <SlopHint>
        Images refresh continuously to prevent automated solving. Your selections are preserved. 🔄
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L07: LevelModule = { meta, Component };
