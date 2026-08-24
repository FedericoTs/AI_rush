"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const TARGET = [0, 4, 1, 2, 8] as const;
const START = [0, 7, 9, 3, 5] as const;
const COLUMNS = TARGET.length;

/**
 * An odometer with no minus.
 *
 * Five columns, a `+` under each, and rolling a column past 9 carries into the
 * column on its **left** — disturbing a digit you have already placed.
 *
 * `LEVELS.md` calls the honest solve "left to right", which is the one thing in
 * that entry that cannot be right: if the carry travels leftward then a column
 * only ever disturbs columns to its left, so the rightmost must be settled
 * first and the leftmost last. Right to left is the ordering where every move
 * is final, which is the family's whole rule — so that is what is built, and it
 * is what the solver test proves.
 *
 * Each column needs `(target − current) mod 10` presses. It is arithmetic, it
 * is completely fair, and under a clock people still get it wrong.
 */
export function pressesFor(current: number, target: number): number {
  return (target - current + 10) % 10;
}

/** One press of the `+` under `col`, carrying leftward past nine. */
export function bump(digits: readonly number[], col: number): number[] {
  const next = [...digits];
  let i = col;
  while (i >= 0) {
    next[i] = (next[i]! + 1) % 10;
    if (next[i] !== 0) break; // no carry unless we wrapped
    i--;
  }
  return next;
}

function Component({ onSolve, rng, sfx }: LevelProps) {
  const [digits, setDigits] = useState<number[]>([...START]);
  const [sub] = useState(() => slopSubhead(rng));
  const [focus, setFocus] = useState(COLUMNS - 1);

  const press = (col: number) => {
    setDigits((d) => bump(d, col));
    sfx.click();
  };

  const done = digits.every((d, i) => d === TARGET[i]);

  return (
    <SlopCard>
      <SlopBadge>Order · Enterprise-Ready</SlopBadge>
      <SlopHeading>Confirm Quantity 📦</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.targetRow}>
        <span>Requested</span>
        <b className={s.targetNum}>{TARGET.join("")}</b>
      </div>

      <div className={s.odometer} data-testid="odometer">
        {digits.map((d, i) => (
          <div className={s.column} key={i}>
            <div
              className={`${s.digit} ${d === TARGET[i] ? s.settled : ""} ${i === focus ? s.focused : ""}`}
              data-testid={`odo-${i}`}
              tabIndex={0}
              role="spinbutton"
              aria-label={`Column ${i + 1}`}
              aria-valuenow={d}
              aria-valuemin={0}
              aria-valuemax={9}
              onFocus={() => setFocus(i)}
              onKeyDown={(e) => {
                /* The number row jumps a focused column straight to that digit.
                   It exists, it works, and it is signposted nowhere. */
                if (/^[0-9]$/.test(e.key)) {
                  e.preventDefault();
                  const want = Number(e.key);
                  setDigits((cur) => {
                    let out = cur;
                    for (let n = 0; n < pressesFor(cur[i]!, want); n++) out = bump(out, i);
                    return out;
                  });
                  sfx.click();
                } else if (e.key === "ArrowUp" || e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  press(i);
                }
              }}
            >
              {d}
            </div>
            <button
              type="button"
              className={s.plus}
              onClick={() => { setFocus(i); press(i); }}
              aria-label={`Increase column ${i + 1}`}
            >
              +
            </button>
          </div>
        ))}
      </div>

      <SlopCta onClick={() => done && onSolve()} disabled={!done}>
        {done ? "Place Order" : "Quantity does not match"}
      </SlopCta>
      <SlopHint>
        Quantities may only be increased. To decrease, increase to 9 and continue. 🔁
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L40: LevelModule = { meta, Component };
