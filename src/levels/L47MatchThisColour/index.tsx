"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import { TOLERANCE, deltaE, hslToRgb, toHex } from "./colour";
import s from "./styles.module.css";

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const SLIDERS: ReadonlyArray<{ key: keyof Hsl; label: string; max: number; unit: string }> = [
  { key: "h", label: "Hue", max: 359, unit: "°" },
  { key: "s", label: "Saturation", max: 100, unit: "%" },
  { key: "l", label: "Lightness", max: 100, unit: "%" },
];

/**
 * Match a swatch with three sliders. The sliders are HSL. The target is quoted
 * as an RGB hex.
 *
 * That mismatch is the visible half of the joke. The invisible half is
 * perceptual: dragging Hue changes how saturated and how light the swatch
 * *looks* even though neither S nor L has moved, so players correct for a
 * change that did not happen and spend thirty seconds chasing their own tail.
 * Nothing in the code is coupled. Your eyes do all of it.
 *
 * The honest solve is in the corner from the first frame: a single delta
 * number that falls as you get closer. This level punishes trusting your eyes
 * and rewards trusting the instrument, which is a nasty and completely fair
 * thing to teach in a game about interfaces that lie.
 *
 * That readout is also why this level is safe to ship. It is sufficient on its
 * own — the whole thing is solvable without perceiving the colours at all, and
 * a colour-matching level that *required* colour vision would be a genuinely
 * bad thing to put in front of people.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [target] = useState<Hsl>(() => ({
    h: rng.range(0, 359),
    s: rng.range(45, 95),
    l: rng.range(30, 70),
  }));
  /* Start somewhere wrong on every axis, but not so far that the first drag
     teaches nothing. */
  const [value, setValue] = useState<Hsl>(() => ({
    h: (target.h + rng.range(70, 290)) % 360,
    s: Math.min(100, Math.max(0, target.s + rng.range(-40, 40))),
    l: Math.min(100, Math.max(0, target.l + rng.range(-30, 30))),
  }));
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const targetRgb = hslToRgb(target.h, target.s, target.l);
  const valueRgb = hslToRgb(value.h, value.s, value.l);
  const delta = deltaE(targetRgb, valueRgb);
  const close = delta < TOLERANCE;

  const set = (key: keyof Hsl, n: number) => {
    setValue((v) => ({ ...v, [key]: n }));
    sfx.blip();
  };

  const submit = () => {
    if (close) {
      sfx.solve();
      onSolve();
      return;
    }
    sfx.fail();
    onFail("not-matched");
    setError(`Not quite — that's ΔE ${delta.toFixed(1)}. We need under ${TOLERANCE}. 🎨`);
  };

  return (
    <SlopCard>
      <SlopBadge>Brand Kit · Enterprise-Grade</SlopBadge>
      <SlopHeading>Match your brand colour 🎨</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.swatches}>
        <div className={s.swatchBlock}>
          <div
            className={s.swatch}
            style={{ background: toHex(targetRgb) }}
            data-testid="l47-target"
            aria-label={`Target colour ${toHex(targetRgb)}`}
          />
          <div className={s.swatchLabel}>
            Target
            <b>{toHex(targetRgb)}</b>
          </div>
        </div>
        <div className={s.swatchBlock}>
          <div
            className={s.swatch}
            style={{ background: toHex(valueRgb) }}
            data-testid="l47-yours"
            aria-label={`Your colour ${toHex(valueRgb)}`}
          />
          <div className={s.swatchLabel}>
            Yours
            <b>{toHex(valueRgb)}</b>
          </div>
        </div>
      </div>

      <div className={s.sliders}>
        {SLIDERS.map(({ key, label, max, unit }) => (
          <label className={s.slider} key={key}>
            <span className={s.sliderHead}>
              {label}
              <b>
                {Math.round(value[key])}
                {unit}
              </b>
            </span>
            <input
              type="range"
              min={0}
              max={max}
              value={value[key]}
              aria-label={label}
              onChange={(e) => set(key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      {/*
        * The instrument. Small, in the corner, present from the first frame,
        * and completely sufficient — this is the level's honest solve and the
        * reason it does not require colour vision to finish.
        */}
      <div className={`${s.readout} ${close ? s.readoutClose : ""}`} data-testid="l47-delta">
        Δ<span>{delta.toFixed(1)}</span>
      </div>

      <button type="button" className={s.cta} onClick={submit}>
        Save Brand Colour
      </button>

      <SlopError>{error}</SlopError>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L47: LevelModule = { meta, Component };
