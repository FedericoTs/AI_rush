"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

/** Three fields, laid out roughly where a form would put them. Priors help. */
const FIELDS = [
  { id: "email", label: "Email", x: 0.5, y: 0.22, w: 0.8, h: 0.16 },
  { id: "code", label: "Code", x: 0.32, y: 0.55, w: 0.44, h: 0.16 },
  { id: "pin", label: "PIN", x: 0.74, y: 0.55, w: 0.36, h: 0.16 },
] as const;

/** Near enough to count as "on" a field, as a fraction of the stage. */
const NEAR = 0.09;

export interface Point { x: number; y: number }

/** Which field the pointer is over, or null. Pure, so it can be tested. */
export function fieldAt(p: Point): (typeof FIELDS)[number] | null {
  for (const f of FIELDS) {
    if (Math.abs(p.x - f.x) <= f.w / 2 && Math.abs(p.y - f.y) <= f.h / 2) return f;
  }
  return null;
}

/** Distance to the nearest field edge, normalised. Drives both tone and glow. */
export function proximity(p: Point): number {
  let best = Infinity;
  for (const f of FIELDS) {
    const dx = Math.max(0, Math.abs(p.x - f.x) - f.w / 2);
    const dy = Math.max(0, Math.abs(p.y - f.y) - f.h / 2);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

/**
 * A form you have to find by ear.
 *
 * The fields are invisible. Moving the pointer plays a tone: pitch encodes
 * vertical position, stereo pan encodes horizontal. Over a field the tone goes
 * clean; away from one it is detuned and rough.
 *
 * The honest solve is a sweep, and the reason it works is that the three fields
 * sit roughly where a normal form would put them — one wide field near the top,
 * two short ones side by side below. Priors do most of the work; the ear only
 * has to confirm.
 *
 * No fail state. Time is the pressure.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  const [filled, setFilled] = useState<Set<string>>(() => new Set());
  const [sub] = useState(() => slopSubhead(rng));
  const [over, setOver] = useState<string | null>(null);
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode; pan: StereoPannerNode } | null>(null);

  /* Torn down on unmount without fail: an oscillator that outlives its level
     is a tone that follows the player into the next one. */
  useEffect(() => {
    return () => {
      const a = audio.current;
      if (!a) return;
      try {
        a.osc.stop();
        void a.ctx.close();
      } catch {
        /* Already closed by the browser. Nothing to do. */
      }
      audio.current = null;
    };
  }, []);

  const ensureAudio = () => {
    if (audio.current || sfx.muted) return audio.current;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      gain.gain.value = 0;
      osc.type = "sine";
      osc.connect(gain).connect(pan).connect(ctx.destination);
      osc.start();
      audio.current = { ctx, osc, gain, pan };
      return audio.current;
    } catch {
      /* No WebAudio. The level is still winnable — see the glow. */
      return null;
    }
  };

  const sweep = (p: Point) => {
    const f = fieldAt(p);
    setOver(f?.id ?? null);

    const a = ensureAudio();
    if (!a || sfx.muted) return;
    const now = a.ctx.currentTime;
    /* Pitch is vertical, pan is horizontal — the two things a stereo tone can
       carry, mapped to the two axes a pointer has. */
    const hz = 220 + (1 - p.y) * 660;
    /* Clean on a field, detuned off it. The "purity" is the signal. */
    const rough = Math.min(1, proximity(p) / NEAR);
    a.osc.frequency.setTargetAtTime(hz * (1 + rough * 0.06), now, 0.02);
    a.osc.type = rough < 0.15 ? "sine" : "sawtooth";
    a.pan.pan.setTargetAtTime(p.x * 2 - 1, now, 0.02);
    a.gain.gain.setTargetAtTime(0.05, now, 0.03);
  };

  const quiet = () => {
    setOver(null);
    const a = audio.current;
    if (a) a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05);
  };

  const toPoint = (e: React.PointerEvent): Point => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
  };

  const done = filled.size === FIELDS.length;

  return (
    <SlopCard>
      <SlopBadge>Accessibility · AI-Powered</SlopBadge>
      <SlopHeading>Adjust Your Volume 🔊</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <p className={s.ask}>
        Three fields. Find each one and click it. {filled.size} of {FIELDS.length} completed.
      </p>

      <div
        className={s.stage}
        data-testid="sonar"
        onPointerMove={(e) => sweep(toPoint(e))}
        onPointerLeave={quiet}
        onPointerDown={(e) => {
          const f = fieldAt(toPoint(e));
          if (!f) return;
          setFilled((cur) => new Set(cur).add(f.id));
          sfx.click();
        }}
      >
        {FIELDS.map((f) => (
          <div
            key={f.id}
            className={`${s.field} ${filled.has(f.id) ? s.filled : ""} ${over === f.id ? s.over : ""}`}
            style={{
              left: `${(f.x - f.w / 2) * 100}%`,
              top: `${(f.y - f.h / 2) * 100}%`,
              width: `${f.w * 100}%`,
              height: `${f.h * 100}%`,
            }}
            data-testid={`field-${f.id}`}
          >
            {filled.has(f.id) && <span>{f.label} ✓</span>}
          </div>
        ))}
      </div>

      <SlopCta onClick={() => done && onSolve()} disabled={!done}>
        {done ? "Submit Form" : "Complete all fields"}
      </SlopCta>
      <SlopHint>
        This form is optimised for audio navigation. Move your pointer to hear where you are. 🎧
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

/**
 * The path for a muted device, a browser with no WebAudio, and Mercy Mode.
 *
 * The fields stay invisible; proximity lights them instead of sounding them. It
 * is the same search with a different sense, and it is deliberately *solvable*
 * rather than merely playable — a level whose only route through requires
 * hearing would be a genuinely bad thing to ship.
 */
function Fallback({ onSolve, rng, sfx }: LevelProps) {
  const [filled, setFilled] = useState<Set<string>>(() => new Set());
  const [near, setNear] = useState<Point | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const toPoint = (e: React.PointerEvent): Point => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
  };

  const done = filled.size === FIELDS.length;

  return (
    <SlopCard>
      <SlopBadge>Accessibility · AI-Powered</SlopBadge>
      <SlopHeading>Adjust Your Volume 🔊</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <p className={s.ask}>
        Three fields. Find each one and click it. {filled.size} of {FIELDS.length} completed.
      </p>

      <div
        className={s.stage}
        data-testid="sonar"
        onPointerMove={(e) => setNear(toPoint(e))}
        onPointerLeave={() => setNear(null)}
        onPointerDown={(e) => {
          const f = fieldAt(toPoint(e));
          if (!f) return;
          setFilled((cur) => new Set(cur).add(f.id));
          sfx.click();
        }}
      >
        {FIELDS.map((f) => {
          const glow = near
            ? Math.max(0, 1 - Math.hypot(near.x - f.x, near.y - f.y) / (NEAR * 3))
            : 0;
          return (
            <div
              key={f.id}
              className={`${s.field} ${filled.has(f.id) ? s.filled : ""}`}
              style={{
                left: `${(f.x - f.w / 2) * 100}%`,
                top: `${(f.y - f.h / 2) * 100}%`,
                width: `${f.w * 100}%`,
                height: `${f.h * 100}%`,
                boxShadow: glow > 0 ? `0 0 ${Math.round(glow * 40)}px rgba(124,58,237,${glow})` : undefined,
                borderColor: glow > 0.35 ? "var(--slop-1)" : undefined,
              }}
              data-testid={`field-${f.id}`}
            >
              {filled.has(f.id) && <span>{f.label} ✓</span>}
            </div>
          );
        })}
      </div>

      <SlopCta onClick={() => done && onSolve()} disabled={!done}>
        {done ? "Submit Form" : "Complete all fields"}
      </SlopCta>
      <SlopHint>
        Audio navigation is unavailable, so fields glow as you approach them instead. 💡
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L29: LevelModule = { meta, Component, Fallback };
