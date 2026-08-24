"use client";

import { useMemo, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { CouplingGraph, type ControlState } from "@/engine/coupling/graph";
import { SlopBadge, SlopCard, SlopCta, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const DAYS = 28;
const START: ControlState = { from: 3, to: 8 };
const TARGET: ControlState = { from: 11, to: 25 };
const MONTH = "October";

/**
 * A range whose two ends are welded together.
 *
 * Moving **From** drags **To** along with it, preserving the gap. Moving **To**
 * changes the gap. You need a range whose length is not the length you started
 * with, so the only control that can get you there is To — and then moving From
 * drags To again, so From has to be set by the offset you want and To corrected
 * once afterwards.
 *
 * Two moves if you see it, seven if you do not. The running "duration: N
 * nights" readout tells you everything, in small grey type, next to the fold.
 *
 * One `propagate` edge, from → to, ratio 1. The graph gives the drag for free
 * and, more usefully, tells the solver the ordering is from-then-to — which is
 * the honest solve, stated by the machinery rather than by a comment.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const graph = useMemo(
    () =>
      new CouplingGraph(
        [
          { id: "from", min: 1, max: DAYS },
          { id: "to", min: 1, max: DAYS },
        ],
        [{ from: "from", to: "to", kind: "propagate", ratio: 1 }],
      ),
    [],
  );

  const [range, setRange] = useState<ControlState>(START);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const nights = Math.max(0, range.to! - range.from!);
  const wantNights = TARGET.to! - TARGET.from!;

  const pick = (day: number, end: "from" | "to") => {
    setRange((prev) => graph.set(prev, end, day));
    setError(null);
    sfx.blip();
  };

  const confirm = () => {
    if (range.from === TARGET.from && range.to === TARGET.to) {
      onSolve();
      return;
    }
    setError(`That's a ${Math.abs(nights)}-night stay. Great choice! ✨`);
    onFail("wrong-range");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Booking · Blazing Fast</SlopBadge>
      <SlopHeading>Choose Your Dates 🗓️</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.want}>
        Requested: <b>{MONTH} {TARGET.from} – {TARGET.to}</b> ({wantNights} nights)
      </div>

      <div className={s.ends}>
        {(["from", "to"] as const).map((end) => (
          <div key={end} className={`${s.end} ${range[end] === TARGET[end] ? s.endOk : ""}`}>
            <span>{end === "from" ? "From" : "To"}</span>
            <b data-testid={`range-${end}`}>{MONTH} {range[end]}</b>
          </div>
        ))}
      </div>

      <div className={s.grid} data-testid="calendar">
        {Array.from({ length: DAYS }, (_, i) => {
          const day = i + 1;
          const inRange = day > range.from! && day < range.to!;
          const isEnd = day === range.from || day === range.to;
          return (
            <button
              key={day}
              type="button"
              className={`${s.day} ${inRange ? s.inRange : ""} ${isEnd ? s.isEnd : ""}`}
              data-testid={`day-${day}`}
              aria-label={`${MONTH} ${day}`}
              onClick={() => pick(day, day <= range.from! ? "from" : "to")}
              onContextMenu={(e) => { e.preventDefault(); pick(day, "from"); }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Everything you need, in ten-pixel grey, next to the fold. */}
      <div className={s.duration}>duration: {nights} nights</div>

      <SlopCta onClick={confirm}>Confirm Dates</SlopCta>
      <SlopError>{error}</SlopError>
      <SlopHint>
        Tap a date before your arrival to move it; tap a later date to set your departure. Your stay
        length is preserved automatically for convenience. 🧳
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L46: LevelModule = { meta, Component };
