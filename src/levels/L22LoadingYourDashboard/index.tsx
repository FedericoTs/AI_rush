"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

/** Pixels of drag for one percent. Higher near the top, where it fights back. */
const PX_PER_PCT = 4;
const DECAY_PER_SEC = 9;

/**
 * The bar climbs to 99%, pauses, and falls to 12%. Forever.
 *
 * In the corner, in nine-pixel grey, is the real progress readout. It is a
 * draggable number, it has been there since the first frame, and it is the
 * only thing on this screen that was ever telling the truth.
 *
 * It resists above 85% and decays when released, so it has to be finished
 * deliberately rather than flung.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  const [fake, setFake] = useState(12);
  const [real, setReal] = useState(0);
  const [grabbed, setGrabbed] = useState(false);
  const [sub] = useState(() => slopSubhead(rng));

  const realRef = useRef(0);
  const draggingRef = useRef(false);
  const doneRef = useRef(false);
  const lastY = useRef(0);

  /* The theatre, and the decay, on one loop. */
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (doneRef.current) return;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      setFake((f) => (f >= 99 ? 12 : f + (f > 90 ? 4 : 34) * dt));

      if (!draggingRef.current && realRef.current > 0) {
        realRef.current = Math.max(0, realRef.current - DECAY_PER_SEC * dt);
        setReal(realRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      doneRef.current = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  const bump = (delta: number) => {
    if (doneRef.current) return;
    /* Gets heavier the closer it is to done. */
    const resistance = realRef.current > 85 ? 0.45 : 1;
    realRef.current = Math.max(0, Math.min(100, realRef.current + delta * resistance));
    setReal(realRef.current);
    if (realRef.current >= 100) {
      doneRef.current = true;
      sfx.pick(4);
      onSolve();
    }
  };

  return (
    <SlopCard>
      <SlopBadge>Loading · Blazing Fast</SlopBadge>
      <SlopHeading>Loading Your Dashboard ⚡</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.bar}>
        <i style={{ width: `${Math.min(99, fake)}%` }} />
      </div>
      <div className={s.pct}>{Math.floor(Math.min(99, fake))}% — almost there!</div>

      <div className={s.skeleton} aria-hidden="true">
        <div className={s.line} style={{ width: "82%" }} />
        <div className={s.line} style={{ width: "64%" }} />
        <div className={s.line} style={{ width: "73%" }} />
      </div>

      <div className={s.corner}>
        <button
          type="button"
          className={`${s.tiny} ${grabbed ? s.grabbed : ""}`}
          aria-label="Actual progress"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            draggingRef.current = true;
            setGrabbed(true);
            lastY.current = e.clientY;
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current) return;
            e.preventDefault();
            bump((lastY.current - e.clientY) / PX_PER_PCT);
            lastY.current = e.clientY;
          }}
          onPointerUp={() => {
            draggingRef.current = false;
            setGrabbed(false);
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
            setGrabbed(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); bump(4); }
            if (e.key === "ArrowDown") { e.preventDefault(); bump(-4); }
          }}
        >
          {real.toFixed(2)}%
        </button>
      </div>

      <SlopHint>
        Your dashboard is being prepared. Please do not close this window. 🔄
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L22: LevelModule = { meta, Component };
