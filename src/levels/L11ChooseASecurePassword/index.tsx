"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const TARGET = "SUNSET7";
/** Decoys are QWERTY neighbours of the correct next character. Deliberately nasty. */
const NEIGHBOURS: Record<string, string> = {
  S: "AWDXZ", U: "YIHJ", N: "BMHJ", E: "WRSD", T: "RYFG", "7": "68YU",
};
const STRENGTH = ["Weak", "Weak", "Fair", "Fair", "Good", "Good", "Strong", "Perfect! ✨"];

const W = 600, H = 220, GROUND = 180;
const SPEED = 268, GRAVITY = 2000, JUMP = -620;

interface Item {
  kind: "cactus" | "letter";
  x: number; y: number; w: number; h: number;
  char?: string;
}

/**
 * The flagship.
 *
 * A password field, a strength meter, and — where the password tips should be —
 * a playable endless runner. Collect SUNSET7 in order by jumping.
 *
 * Letters sit at jump apex and cacti sit on the ground, so staying grounded
 * ducks under letters and the real trap is a decoy placed just past a cactus
 * you had to jump. Runner speed never escalates on retry: P3 says cruel, not
 * tedious, and a level that gets faster every death is the other thing.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [collected, setCollected] = useState(0);
  const [sub] = useState(() => slopSubhead(rng));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  /*
   * The loop starts once and runs until unmount.
   *
   * Depending on the callback props directly means any change in their
   * identity restarts the game — which is how this level ended up resetting
   * sixty times a second. The engine keeps them stable now, but a game loop
   * should not be able to break because a parent re-rendered, so the latest
   * ones are read through a ref and the effect owns nothing but the canvas.
   */
  const cbs = useRef({ onSolve, onFail, sfx, rng });
  useEffect(() => {
    cbs.current = { onSolve, onFail, sfx, rng };
  });

  /* Frame state lives in refs. Sixty re-renders a second is not a game loop. */
  const got = useRef(0);
  const done = useRef(false);
  const dino = useRef({ x: 64, y: GROUND - 32, w: 26, h: 32, vy: 0, airborne: false });
  const items = useRef<Item[]>([]);
  const nextSpawn = useRef(1.1);
  const flash = useRef(0);
  const elapsed = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { rng } = cbs.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.aspectRatio = `${W} / ${H}`;
    ctx.scale(dpr, dpr);

    const needed = () => TARGET[got.current] as string;

    const reset = (reason: string) => {
      got.current = 0;
      setCollected(0);
      items.current = [];
      nextSpawn.current = 1.1;
      elapsed.current = 0;
      dino.current = { x: 64, y: GROUND - 32, w: 26, h: 32, vy: 0, airborne: false };
      flash.current = 0.55;
      cbs.current.onFail(reason);
      cbs.current.sfx.fail();
    };

    const jump = () => {
      if (done.current || dino.current.airborne) return;
      dino.current.vy = JUMP;
      dino.current.airborne = true;
      cbs.current.sfx.thud();
    };

    const spawn = () => {
      const tail = items.current[items.current.length - 1];
      if (tail && tail.x > W - 300) return; // never spawn an unjumpable pair
      if (rng() < 0.35) {
        items.current.push({ kind: "cactus", x: W + 30, y: GROUND - 36, w: 16, h: 36 });
      } else {
        const want = needed();
        const char = rng() < 0.6 ? want : (NEIGHBOURS[want] ?? "QWERTY");
        items.current.push({
          kind: "letter", x: W + 30, y: 60, w: 30, h: 30,
          char: char.length === 1 ? char : (char[rng.int(char.length)] as string),
        });
      }
    };

    const step = (dt: number) => {
      elapsed.current += dt;
      nextSpawn.current -= dt;
      if (nextSpawn.current <= 0) {
        spawn();
        nextSpawn.current = 1.05 + rng() * 0.35;
      }

      const d = dino.current;
      d.vy += GRAVITY * dt;
      d.y += d.vy * dt;
      if (d.y >= GROUND - d.h) { d.y = GROUND - d.h; d.vy = 0; d.airborne = false; }

      for (let i = items.current.length - 1; i >= 0; i--) {
        const it = items.current[i]!;
        it.x -= SPEED * dt;
        if (it.x + it.w < -10) { items.current.splice(i, 1); continue; }
        const hit = d.x < it.x + it.w && d.x + d.w > it.x && d.y < it.y + it.h && d.y + d.h > it.y;
        if (!hit) continue;

        if (it.kind === "cactus") return reset("cactus");
        items.current.splice(i, 1);
        if (it.char === needed()) {
          got.current++;
          setCollected(got.current);
          cbs.current.sfx.pick(got.current);
          if (got.current === TARGET.length) { done.current = true; cbs.current.onSolve(); }
        } else {
          return reset("wrong-letter");
        }
      }
      if (flash.current > 0) flash.current -= dt;
    };

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      if (flash.current > 0) {
        ctx.fillStyle = `rgba(239,68,68,${flash.current * 0.34})`;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.strokeStyle = "#C9C2EC";
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -(elapsed.current * SPEED) % 16;
      ctx.beginPath();
      ctx.moveTo(0, GROUND + 1);
      ctx.lineTo(W, GROUND + 1);
      ctx.stroke();
      ctx.setLineDash([]);

      const d = dino.current;
      const bob = d.airborne ? 0 : Math.floor(elapsed.current * 11) % 2;
      ctx.fillStyle = "#6D28D9";
      ctx.fillRect(d.x, d.y + bob, d.w, d.h - 8);
      ctx.fillRect(d.x + d.w - 4, d.y + bob + 3, 9, 11);
      ctx.fillRect(d.x - 7, d.y + bob + 9, 8, 7);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(d.x + d.w + 1, d.y + bob + 6, 3, 3);
      ctx.fillStyle = "#6D28D9";
      if (d.airborne) {
        ctx.fillRect(d.x + 4, d.y + d.h - 8, 6, 7);
        ctx.fillRect(d.x + 15, d.y + d.h - 8, 6, 7);
      } else {
        const f = Math.floor(elapsed.current * 11) % 2;
        ctx.fillRect(d.x + 4, d.y + d.h - 8 + bob, 6, 8 - f * 2);
        ctx.fillRect(d.x + 14, d.y + d.h - 8 + bob, 6, 6 + f * 2);
      }

      for (const it of items.current) {
        if (it.kind === "cactus") {
          ctx.fillStyle = "#4C1D95";
          ctx.fillRect(it.x + 5, it.y, 7, it.h);
          ctx.fillRect(it.x, it.y + 11, 5, 4);
          ctx.fillRect(it.x, it.y + 11, 3, 12);
          ctx.fillRect(it.x + 12, it.y + 6, 5, 4);
          ctx.fillRect(it.x + 14, it.y + 6, 3, 14);
        } else {
          const ok = it.char === needed();
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = ok ? "#7C3AED" : "#D6CFF0";
          ctx.lineWidth = 2;
          roundRect(it.x, it.y, it.w, it.h, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = ok ? "#5B21B6" : "#A79BD4";
          ctx.font = "700 17px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(it.char ?? "", it.x + it.w / 2, it.y + it.h / 2 + 1);
        }
      }

      ctx.fillStyle = "#B9B2E0";
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(`NEXT: ${needed()}`, W - 10, 8);
    };

    let raf = 0;
    let last = 0;
    let startedAt = 0;
    let publishedSecond = -1;
    const loop = (t: number) => {
      if (done.current) return;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      step(dt);
      if (done.current) return;
      draw();
      /*
       * Seconds since this loop started, which is not the same as seconds of
       * gameplay: `elapsed` resets every time the dino dies, so it cannot tell
       * a normal death from the loop being torn down and rebuilt. Uptime only
       * ever returns to zero if the effect re-ran, which is precisely the
       * regression that made this level unplayable.
       *
       * One attribute write per second, not per frame.
       */
      if (!startedAt) startedAt = t;
      const upSecond = Math.floor((t - startedAt) / 1000);
      if (upSecond !== publishedSecond) {
        publishedSecond = upSecond;
        canvas.dataset.uptime = String(upSecond);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
    };
    const onTap = (e: Event) => { e.preventDefault(); jump(); };
    window.addEventListener("keydown", onKey);
    const stage = stageRef.current;
    stage?.addEventListener("pointerdown", onTap);

    return () => {
      done.current = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      stage?.removeEventListener("pointerdown", onTap);
    };
  }, []);

  return (
    <SlopCard>
      <SlopBadge>Step 2 of 2 · AI-Powered</SlopBadge>
      <SlopHeading>Choose A Secure Password 🦖</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.field}>
        <span className={s.value}>
          {TARGET.split("").map((ch, i) => (
            <span key={i} className={i < collected ? undefined : s.ghost}>{ch}</span>
          ))}
        </span>
        <span className={s.strength}>{STRENGTH[collected]}</span>
      </div>
      <div className={s.meter}>
        <i style={{ width: `${(collected / TARGET.length) * 100}%` }} />
      </div>

      <div className={s.stage} ref={stageRef}>
        <canvas ref={canvasRef} />
        <div className={s.tip}>tap / space to jump</div>
      </div>

      <SlopHint>
        Password tips: collect the characters shown above, in order. Avoid characters that are
        not in your password. 💡
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L11: LevelModule = {
  meta,
  Component,
};
