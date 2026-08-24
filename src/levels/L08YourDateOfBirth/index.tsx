"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const TARGET = { day: 14, month: 6, year: 1988 } as const;

interface WheelSpec {
  key: "day" | "month" | "year";
  label: string;
  min: number;
  max: number;
  /** Velocity retained per frame. Higher spins longer. */
  friction: number;
  /** Multiplies velocity every frame while spinning. >1 runs away. */
  gain: number;
}

const WHEELS: readonly WheelSpec[] = [
  { key: "day", label: "Day", min: 1, max: 31, friction: 0.86, gain: 1 },
  { key: "month", label: "Month", min: 1, max: 12, friction: 0.9, gain: 1 },
  /* The year wheel accelerates the longer it runs. It never quite stops. */
  { key: "year", label: "Year", min: 1900, max: 2099, friction: 0.97, gain: 1.012 },
];

const wrap = (v: number, min: number, max: number) => {
  const span = max - min + 1;
  return min + (((v - min) % span) + span) % span;
};

/**
 * Three slot-machine wheels, one of which does not want to stop.
 *
 * Day and month have ordinary momentum. The year wheel runs 1900–2099, holds
 * its velocity far longer, and **gains** speed the longer it spins — so a
 * confident flick sends it somewhere in the twenty-second century and keeps
 * going.
 *
 * Two honest escapes and both are ordinary physical instincts. Short deliberate
 * flicks: release near zero velocity and the wheel snaps to the nearest notch.
 * Or tap a moving wheel once — a hard stop, exactly the way you would slap a
 * spinning globe.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [value, setValue] = useState(() => ({
    day: rng.range(1, 31),
    month: rng.range(1, 12),
    year: rng.range(1960, 2099),
  }));
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const velocity = useRef<Record<string, number>>({ day: 0, month: 0, year: 0 });
  const drag = useRef<{ key: string; y: number; moved: number } | null>(null);
  const [spinning, setSpinning] = useState(false);

  /* One loop for every wheel, running only while something is moving. */
  useEffect(() => {
    if (!spinning) return;
    let raf = 0;
    const tick = () => {
      let any = false;
      setValue((cur) => {
        const next = { ...cur };
        for (const w of WHEELS) {
          const v = velocity.current[w.key] ?? 0;
          if (Math.abs(v) < 0.02) {
            velocity.current[w.key] = 0;
            continue;
          }
          any = true;
          next[w.key] = wrap(Math.round(next[w.key] + v), w.min, w.max);
          velocity.current[w.key] = v * w.friction * w.gain;
        }
        return next;
      });
      if (any) raf = requestAnimationFrame(tick);
      else setSpinning(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning]);

  const nudge = (key: WheelSpec["key"], by: number) => {
    const w = WHEELS.find((x) => x.key === key)!;
    velocity.current[key] = 0;
    setValue((cur) => ({ ...cur, [key]: wrap(cur[key] + by, w.min, w.max) }));
    sfx.click();
  };

  const onDown = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    /* A tap on a moving wheel is a hard stop. The discoverable escape. */
    if ((velocity.current[key] ?? 0) !== 0) {
      velocity.current[key] = 0;
      sfx.click();
    }
    drag.current = { key, y: e.clientY, moved: 0 };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const dy = d.y - e.clientY;
    d.y = e.clientY;
    d.moved += Math.abs(dy);
    const w = WHEELS.find((x) => x.key === d.key)!;
    setValue((cur) => ({ ...cur, [d.key]: wrap(cur[d.key as "day"] + Math.round(dy / 8), w.min, w.max) }));
    velocity.current[d.key] = dy / 10;
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    /* Released near zero: it snaps. Released with pace: it runs. */
    if (Math.abs(velocity.current[d.key] ?? 0) < 0.35) {
      velocity.current[d.key] = 0;
      return;
    }
    setSpinning(true);
  };

  const confirm = () => {
    if (value.day === TARGET.day && value.month === TARGET.month && value.year === TARGET.year) {
      onSolve();
      return;
    }
    setError(`You must be 18 or older. You entered: ${value.year}.`);
    onFail("wrong-dob");
    sfx.fail();
  };

  const shown = (w: WheelSpec) => (w.key === "month" ? MONTHS[value.month - 1] : value[w.key]);

  return (
    <SlopCard>
      <SlopBadge>Verification · Bank-Level Security</SlopBadge>
      <SlopHeading>Your Date Of Birth 🎂</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.want}>
        On file: <b>{TARGET.day} {MONTHS[TARGET.month - 1]} {TARGET.year}</b>
      </div>

      <div className={s.wheels} data-testid="wheels">
        {WHEELS.map((w) => (
          <div className={s.wheel} key={w.key}>
            <div
              className={`${s.window} ${value[w.key] === TARGET[w.key] ? s.settled : ""}`}
              tabIndex={0}
              role="spinbutton"
              aria-label={w.label}
              aria-valuenow={value[w.key]}
              aria-valuetext={String(shown(w))}
              data-testid={`wheel-${w.key}`}
              onPointerDown={(e) => onDown(e, w.key)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") { e.preventDefault(); nudge(w.key, 1); }
                else if (e.key === "ArrowDown") { e.preventDefault(); nudge(w.key, -1); }
              }}
            >
              <span>{shown(w)}</span>
            </div>
            <div className={s.label}>{w.label}</div>
          </div>
        ))}
      </div>

      <SlopCta onClick={confirm}>Confirm Date Of Birth</SlopCta>
      <SlopError>{error}</SlopError>
      <SlopHint>
        Flick a wheel to spin it. Wheels use realistic momentum for a natural feel. 🎡
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L08: LevelModule = { meta, Component };
