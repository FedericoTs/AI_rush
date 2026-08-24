"use client";

import { useEffect, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const TARGET = 3;
const MAX = 10_000;
/** How long the fine controls stay invisible. Long enough to hurt. */
const REVEAL_MS = 8_000;

/**
 * "How many licenses do you need? (1–10)" — implemented as a slider with a
 * range of nought to ten thousand and no snapping.
 *
 * The fine controls exist from the first frame and are simply too quiet to
 * notice, fading in after eight seconds. Arrow keys have always stepped by
 * one. Nothing here is unfair; it is just hostile to the way anyone would
 * actually approach it.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [value, setValue] = useState(4_137);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [sub] = useState(() => slopSubhead(rng));

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const nudge = (d: number) => {
    setValue((v) => Math.max(0, Math.min(MAX, v + d)));
    sfx.click();
  };

  const confirm = () => {
    if (value === TARGET) {
      onSolve();
      return;
    }
    setError(`Are you sure? That's ${value.toLocaleString()} licenses.`);
    setValue(5_000);
    onFail("wrong-quantity");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Plan · Enterprise-Grade</SlopBadge>
      <SlopHeading>How Many? 🎚️</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <p style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", color: "var(--slop-ink)" }}>
        How many licenses do you need? <strong>(1–10)</strong>
      </p>

      <div className={`${s.readout} ${value === TARGET ? s.ok : ""}`}>
        <span className={s.value}>{value.toLocaleString()}</span>
        <span className={s.unit}>licenses</span>
      </div>

      <input
        className={s.track}
        type="range"
        min={0}
        max={MAX}
        step={1}
        value={value}
        aria-label="Number of licenses"
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <div className={s.scale}>
        <span>0</span>
        <span>{MAX.toLocaleString()}</span>
      </div>

      <div className={`${s.fine} ${revealed ? s.fineOn : ""}`}>
        <button type="button" onClick={() => nudge(-1)} aria-label="One fewer">−1</button>
        <span>fine adjust</span>
        <button type="button" onClick={() => nudge(1)} aria-label="One more">+1</button>
      </div>

      <SlopCta onClick={confirm}>Continue To Checkout</SlopCta>
      <SlopError>{error}</SlopError>
      <SlopHint>
        Drag the slider to choose. Arrow keys adjust by one for precision users. 🎯
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L04: LevelModule = { meta, Component };
