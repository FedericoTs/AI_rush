"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import { MODULE, offFromTop, pitchRadius, toothPath, trainAngles, trainRatio, type Gear } from "./gears";
import s from "./styles.module.css";

/**
 * Six gears, meshing, with a genuine 7:1 reduction.
 *
 * `LEVELS.md` asks for a train where "you may drag only the largest gear" and
 * "the marked tooth moves at 1/7th your input". Those two cannot both be true.
 * For the output to turn *slower* than the input it has to be the bigger gear —
 * that is what a reduction is — so the drive must be the small one. Building
 * the spec as written gives a ratio of 3: the marked tooth would move three
 * times faster than the drag, not a seventh.
 *
 * Since this is the one level where being mechanically accurate *is* the joke,
 * the arithmetic wins and the sentence changes. 7T drives 49T through four
 * idlers, which is exactly 1/7, and the four in between cancel — a real
 * property of simple gear trains, and a much better thing to print in the
 * specifications footer than a number we made up.
 */
const TEETH = [7, 12, 9, 14, 11, 49] as const;
/** The one you can turn. Small, so you have to turn it a lot. */
const DRIVE = 0;
/** The one with the painted tooth. */
const MARKED = TEETH.length - 1;
const RATIO = trainRatio(TEETH);
/** Radians. Generous — this is a positioning task, not a pixel hunt. */
const TOLERANCE = 0.16;
const CANVAS = { w: 320, h: 190 };

/** Lay the train out left to right, each gear touching the last. */
function layout(): Gear[] {
  const gears: Gear[] = [];
  let x = pitchRadius(TEETH[0]!) + 6;
  const y = CANVAS.h / 2;
  for (let i = 0; i < TEETH.length; i++) {
    if (i > 0) x += pitchRadius(TEETH[i - 1]!) + pitchRadius(TEETH[i]!);
    gears.push({ cx: x, cy: y, teeth: TEETH[i]!, phase: 0 });
  }
  return gears;
}

/**
 * The gear train, made literal.
 *
 * Six interlocking gears, rendered with involute teeth and correct meshing. One
 * has a red-painted tooth; rotate it to the top. You may drag **only the
 * largest gear**, and the ratios mean the marked tooth moves at a seventh of
 * your input and in the opposite direction.
 *
 * The honest solve is to work out the direction — it is the opposite of what
 * you want — and commit to a long drag. The ratio is fixed and displayed, in
 * tiny mono type, in a "technical specifications" footer nobody reads until
 * minute four.
 *
 * No fail state. It is a positioning task and the clock is the pressure.
 *
 * The geometry lives in `gears.ts` as plain arithmetic so the mesh can be
 * tested rather than eyeballed: a fake approximation here reads as a bug rather
 * than a bit, and that is the one thing this level cannot survive.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [drive, setDrive] = useState(() => rng.range(20, 340) * (Math.PI / 180));
  const [sub] = useState(() => slopSubhead(rng));
  const drag = useRef<{ x: number } | null>(null);
  const gears = useRef<Gear[]>(layout());

  const angles = trainAngles(TEETH, drive);
  const marked = angles[MARKED]!;
  const off = offFromTop(marked);
  const aligned = Math.abs(off) <= TOLERANCE;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    el.width = CANVAS.w * dpr;
    el.height = CANVAS.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS.w, CANVAS.h);

    const now = trainAngles(TEETH, drive);
    gears.current.forEach((g, i) => {
      const gear: Gear = { ...g, phase: now[i]! };
      const path = toothPath(gear);

      ctx.beginPath();
      path.forEach(([x, y], n) => (n === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = i === DRIVE ? "#b9c2d0" : "#e6eaf0";
      ctx.fill();
      ctx.strokeStyle = "#8b95a5";
      ctx.lineWidth = 1;
      ctx.stroke();

      /* Hub, so the eye can read rotation on a gear with no marked tooth. */
      ctx.beginPath();
      ctx.arc(gear.cx, gear.cy, Math.max(3, pitchRadius(gear.teeth) * 0.22), 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#8b95a5";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gear.cx, gear.cy);
      ctx.lineTo(
        gear.cx + Math.cos(gear.phase) * pitchRadius(gear.teeth) * 0.6,
        gear.cy + Math.sin(gear.phase) * pitchRadius(gear.teeth) * 0.6,
      );
      ctx.strokeStyle = "#b3bcc9";
      ctx.stroke();

      /* The painted tooth, on the last gear only. */
      if (i === MARKED) {
        const r = pitchRadius(gear.teeth) + MODULE * 0.6;
        ctx.beginPath();
        ctx.arc(
          gear.cx + Math.cos(gear.phase) * r,
          gear.cy + Math.sin(gear.phase) * r,
          3.4,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = aligned ? "#12a06f" : "#e5484d";
        ctx.fill();
      }
    });

    /* Where the marked tooth is supposed to end up. */
    const last = gears.current[MARKED]!;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(last.cx, last.cy - pitchRadius(last.teeth) - 10);
    ctx.lineTo(last.cx, last.cy - pitchRadius(last.teeth) - 2);
    ctx.strokeStyle = aligned ? "#12a06f" : "#98a2b0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }, [drive, aligned]);

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    if (dx !== 0) {
      setDrive((a) => a + dx * 0.012);
      sfx.blip();
    }
  };

  const onUp = () => {
    drag.current = null;
  };

  return (
    <SlopCard>
      <SlopBadge>Verification · SOC2 (pending)</SlopBadge>
      <SlopHeading>Human Verification Required 🤖</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <p className={s.task}>Rotate the marked tooth to the top position.</p>

      <div
        className={s.stage}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        tabIndex={0}
        role="slider"
        aria-label="Drive gear"
        aria-valuenow={Math.round((drive * 180) / Math.PI)}
        aria-valuemin={-360}
        aria-valuemax={360}
        data-aligned={aligned ? "yes" : "no"}
        data-testid="gear-stage"
        onKeyDown={(e) => {
          /* One tooth of the drive gear per press. Slow, exact, and on a long
             enough run the better strategy — which is the joke twice over. */
          const tooth = (Math.PI * 2) / TEETH[DRIVE]!;
          if (e.key === "ArrowRight") { e.preventDefault(); setDrive((a) => a + tooth); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); setDrive((a) => a - tooth); }
        }}
      >
        <canvas ref={canvas} style={{ width: CANVAS.w, height: CANVAS.h }} />
      </div>

      <SlopCta onClick={() => aligned && onSolve()} disabled={!aligned}>
        {aligned ? "Verify I Am Human" : "Marked tooth not in position"}
      </SlopCta>

      {/* The specification nobody reads until minute four. */}
      <div className={s.spec}>
        technical specifications · drive {TEETH[DRIVE]}T · output {TEETH[MARKED]}T ·
        ratio {RATIO.toFixed(4)} · 5 meshes · intermediate gears are idlers and
        do not affect the ratio, only the direction
      </div>

      <SlopHint>
        Drag anywhere on the mechanism to turn the drive gear — the small one on the left. Only
        the drive gear may be moved directly, for security reasons. 🔩
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L38: LevelModule = { meta, Component };
