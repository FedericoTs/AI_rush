"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { SlopBadge, SlopCard, SlopCta, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const TARGET = [4, 1, 5, 5, 5, 5, 0, 1, 9, 2] as const;
/** The fourth fader reads upside down. */
const INVERTED = 3;
/** The seventh coasts past where you let go — and drags its neighbour on the way. */
const MOMENTUM = 6;

const clamp = (v: number) => Math.max(0, Math.min(9, v));
const format = (a: readonly number[]) =>
  `(${a.slice(0, 3).join("")}) ${a.slice(3, 6).join("")}-${a.slice(6).join("")}`;

/**
 * Ten faders, one phone number.
 *
 * Dragging a fader drags its LEFT neighbour by half the delta, so interference
 * propagates leftward and the honest solve is right to left — each fader you
 * set only disturbs ones you have not reached yet. Nothing signposts this.
 *
 * Positions are continuous floats with the digit rounded only for display.
 * That matters: rounding the coupled delta per pointer event lets a slow,
 * careful drag produce round(0.2) = 0 every frame and dodge the interference
 * entirely, which quietly turns the level into a free 250 points.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const start = useMemo(() => Array.from({ length: 10 }, () => rng.int(10)), [rng]);
  /* `fine` holds continuous positions; `values` is what the form reads. */
  const fine = useRef<number[]>([...start]);
  const [values, setValues] = useState<number[]>(start);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const drag = useRef<{ index: number; last: number; velocity: number } | null>(null);
  const coast = useRef<{ index: number; value: number; velocity: number } | null>(null);
  const raf = useRef(0);

  const commit = useCallback(() => setValues(fine.current.map(Math.round)), []);

  const setFader = useCallback(
    (index: number, value: number, delta: number) => {
      fine.current[index] = clamp(value);
      if (delta && index > 0) fine.current[index - 1] = clamp(fine.current[index - 1]! + delta / 2);
      commit();
    },
    [commit],
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const valueFromPointer = (track: HTMLElement, clientY: number, index: number) => {
    const r = track.getBoundingClientRect();
    let p = 1 - (clientY - r.top) / r.height;
    if (index === INVERTED) p = 1 - p;
    return clamp(p * 9);
  };

  const onPointerDown = (e: React.PointerEvent, index: number) => {
    const track = e.currentTarget as HTMLElement;
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    const raw = valueFromPointer(track, e.clientY, index);
    drag.current = { index, last: raw, velocity: 0 };
    setFader(index, raw, raw - fine.current[index]!);
    sfx.click();
  };

  const onPointerMove = (e: React.PointerEvent, index: number) => {
    const d = drag.current;
    if (!d || d.index !== index) return;
    e.preventDefault();
    const raw = valueFromPointer(e.currentTarget as HTMLElement, e.clientY, index);
    const delta = raw - d.last;
    d.velocity = delta;
    d.last = raw;
    setFader(index, raw, delta);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.index !== MOMENTUM || Math.abs(d.velocity) <= 0.12) return;

    coast.current = { index: d.index, value: fine.current[d.index]!, velocity: d.velocity * 9 };
    let last = 0;
    const step = (t: number) => {
      const c = coast.current;
      if (!c) return;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const before = fine.current[c.index]!;
      const next = clamp(c.value + c.velocity * dt * 3.2);
      c.value = next;
      c.velocity *= 0.88;
      setFader(c.index, next, next - before);
      if (Math.abs(c.velocity) < 0.25 || next <= 0 || next >= 9) {
        coast.current = null;
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  /* Keyboard steps exactly, and couples exactly the same way. Slower than
     dragging, entirely reliable — a legitimate strategy, not a cheat. */
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let d = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    if (index === INVERTED) d = -d;
    setFader(index, Math.round(fine.current[index]!) + d, d);
    sfx.click();
  };

  const send = () => {
    const bad = values.findIndex((v, i) => v !== TARGET[i]);
    if (bad < 0) {
      onSolve();
      return;
    }
    setError(`We've sent a code to ${format(values)} — is that right?`);
    for (let j = Math.max(0, bad - 1); j <= Math.min(9, bad + 1); j++) {
      fine.current[j] = rng.int(10);
    }
    commit();
    onFail("wrong-number");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Verification · Enterprise-Grade</SlopBadge>
      <SlopHeading>Enter Your Phone Number</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.target}>
        Enter: <b>{format(TARGET)}</b>
      </div>

      <div className={s.bank}>
        {values.map((value, i) => {
          const pct = value / 9;
          const shown = i === INVERTED ? 1 - pct : pct;
          return (
            <div key={i} className={`${s.fader} ${value === TARGET[i] ? s.ok : ""}`}>
              <div className={s.digit}>{value}</div>
              <div
                className={`${s.track} ${i === INVERTED ? s.inverted : ""}`}
                tabIndex={0}
                role="slider"
                aria-label={`Digit ${i + 1}`}
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={9}
                onPointerDown={(e) => onPointerDown(e, i)}
                onPointerMove={(e) => onPointerMove(e, i)}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <div className={s.fill} style={{ height: `${shown * 100}%` }} />
                <div className={s.knob} style={{ bottom: `calc(${shown * 100}% - 8px)` }} />
              </div>
              <div className={s.idx}>{i + 1}</div>
            </div>
          );
        })}
      </div>

      <div className={s.readout}>{format(values)}</div>
      <SlopCta onClick={send}>Send Verification Code</SlopCta>
      <SlopError>{error}</SlopError>
      <SlopHint>
        Drag a fader to set its digit. Faders are placed close together for your convenience. 📱
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L12: LevelModule = {
  meta: {
    id: "L12",
    slug: "enter-your-phone-number",
    title: "Enter Your Phone Number",
    tier: "cursed",
    family: "coupled",
    parSeconds: 25,
    requires: ["pointer"],
    incompatibleModifiers: ["slippery"],
  },
  Component,
};
