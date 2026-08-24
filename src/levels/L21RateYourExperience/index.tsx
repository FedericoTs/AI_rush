"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const STARS = 5;
const WANT = 4;
/** How far behind the pointer the fill runs. The whole level. */
const LAG_MS = 500;

/**
 * A rating that registers where your cursor *was*.
 *
 * Five stars, and you must give exactly four. The fill follows your pointer
 * five hundred milliseconds behind — and the click registers against the
 * **lagged** position, not the real one.
 *
 * Two honest routes, and both are findable. Lead the target, like shooting at
 * something moving: aim past four and click when the fill arrives. Or stop
 * moving, wait half a second for the fill to catch up, and click into a settled
 * value — which is slower, completely reliable, and the thing nobody tries
 * first.
 *
 * Touch has no hover, so on touch the same lag is applied to a dragged thumb.
 * Identical difficulty, identical solve.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  /* Where the pointer is, and where the interface admits it is. */
  const hover = useRef(0);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  useEffect(() => {
    /* A queue of delayed samples rather than a single timer: the fill has to
       *trail* continuously, not jump to the latest value every 500ms. */
    const id = setInterval(() => {
      const at = hover.current;
      setTimeout(() => setShown(at), LAG_MS);
    }, 60);
    return () => clearInterval(id);
  }, []);

  const track = (value: number) => {
    hover.current = value;
  };

  const commit = () => {
    if (shown === WANT) {
      onSolve();
      return;
    }
    setError(`Thanks for the ${shown} stars! We'll do better. 💔`);
    hover.current = 0;
    setShown(0);
    onFail("wrong-rating");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Feedback · Trusted by Teams</SlopBadge>
      <SlopHeading>Rate Your Experience ⭐</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <p className={s.ask}>
        Please give us exactly <b>{WANT} stars</b>. Your honest feedback matters to us.
      </p>

      <div
        className={s.stars}
        data-testid="stars"
        onPointerLeave={() => track(0)}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientX - box.left) / box.width;
          track(Math.max(0, Math.min(STARS, Math.ceil(frac * STARS))));
        }}
      >
        {Array.from({ length: STARS }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`${s.star} ${i < shown ? s.lit : ""}`}
            onClick={commit}
            aria-label={`${i + 1} stars`}
            data-testid={`star-${i + 1}`}
          >
            ★
          </button>
        ))}
      </div>

      <div className={s.readout} data-testid="rating-readout">
        {shown === 0 ? "No rating yet" : `${shown} of ${STARS}`}
      </div>

      <SlopError>{error}</SlopError>
      <SlopHint>
        Hover to preview your rating, then click to submit. Preview may take a moment to reflect
        your selection. ⏳
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L21: LevelModule = { meta, Component };
