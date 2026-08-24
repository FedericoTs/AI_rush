"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const START_SECONDS = 10;
/** Hold still this long and it comes to you. */
const CALM_MS = 2000;
const FLEE_RADIUS = 130;

/**
 * "Are you still there?" — with a Yes button that runs from the cursor,
 * toward whichever corner you are nearest.
 *
 * Two escapes, both real and neither signposted. Stop moving for two seconds
 * and it walks over to you. Or press Tab and then Enter, because it is still
 * a button and nobody broke the keyboard.
 *
 * Timing out is not a dead end: the modal comes back shorter, which is worse.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [pos, setPos] = useState({ x: 50, y: 55 });
  const [left, setLeft] = useState(START_SECONDS);
  const [calm, setCalm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const arena = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const lastMove = useRef(0);
  const limit = useRef(START_SECONDS);
  const solved = useRef(false);

  /* Countdown, and the two-second stillness that summons the button. */
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let elapsed = 0;

    const tick = (t: number) => {
      if (solved.current) return;
      if (!last) last = t;
      const dt = (t - last) / 1000;
      last = t;
      elapsed += dt;

      const remaining = Math.max(0, limit.current - elapsed);
      setLeft(Math.ceil(remaining));

      const still = lastMove.current > 0 && t - lastMove.current > CALM_MS;
      setCalm(still);
      if (still && pointer.current) {
        /* It has decided you are trustworthy. */
        setPos((p) => ({
          x: p.x + (pointer.current!.x - p.x) * Math.min(1, dt * 2.2),
          y: p.y + (pointer.current!.y - p.y) * Math.min(1, dt * 2.2),
        }));
      }

      if (remaining <= 0) {
        elapsed = 0;
        limit.current = Math.max(5, limit.current - 2);
        setError("Session expired for your security. Please confirm you are still there.");
        setPos({ x: 50, y: 55 });
        onFail("timeout");
        sfx.fail();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      solved.current = true;
      cancelAnimationFrame(raf);
    };
  }, [onFail, sfx]);

  const onPointerMove = (e: React.PointerEvent) => {
    const box = arena.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((e.clientX - box.left) / box.width) * 100;
    const py = ((e.clientY - box.top) / box.height) * 100;
    pointer.current = { x: px, y: py };
    lastMove.current = performance.now();

    setPos((p) => {
      const dx = p.x - px;
      const dy = p.y - py;
      const dist = Math.hypot(dx * (box.width / 100), dy * (box.height / 100));
      if (dist > FLEE_RADIUS) return p;
      /* Away from the cursor, and pinned inside the arena. */
      const scale = (FLEE_RADIUS - dist) / FLEE_RADIUS;
      return {
        x: Math.max(12, Math.min(88, p.x + dx * scale * 0.9)),
        y: Math.max(18, Math.min(82, p.y + dy * scale * 0.9)),
      };
    });
  };

  const confirm = () => {
    solved.current = true;
    sfx.pick(2);
    onSolve();
  };

  const logOut = () => {
    setError("You have been signed out. Confirm you are still there to sign back in.");
    setPos({ x: 50, y: 55 });
    onFail("logged-out");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Session · Bank-Level Security</SlopBadge>
      <SlopHeading>Are You Still There? 👀</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.arena} ref={arena} onPointerMove={onPointerMove}>
        <div className={`${s.countdown} ${left <= 3 ? s.urgent : ""}`}>0:{String(left).padStart(2, "0")}</div>

        <button
          type="button"
          className={`${s.yes} ${calm ? s.calm : ""}`}
          style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
          onClick={confirm}
        >
          Yes, I&rsquo;m here
        </button>

        {/* The honest option, which does exactly what it says and is therefore
            no help at all. Without this the fleeing button has no teeth: any
            second working button is just a way to skip the level. */}
        <button type="button" className={s.no} onClick={logOut}>
          Log me out
        </button>
        <span className={s.tip}>this session will end automatically</span>
      </div>

      <SlopError>{error}</SlopError>
      <SlopHint>
        For your security we end inactive sessions. Confirm you are still there to continue. ⏳
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L28: LevelModule = { meta, Component };
