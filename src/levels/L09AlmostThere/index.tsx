"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopCard } from "@/ui/slop/Slop";
import s from "./styles.module.css";

const PRODUCTS = [
  { name: "Synthase", pitch: "The AI-native workspace for teams that ship." },
  { name: "Cognify", pitch: "Turn your meetings into decisions. Automatically." },
  { name: "Perceptr", pitch: "One API for every model you'll never evaluate." },
  { name: "Loopwise", pitch: "Agentic workflows for the agentic enterprise." },
  { name: "Verba", pitch: "Your documents, but they answer back." },
];

const FIRST_WAIT = 5;
const PUNISHED_WAIT = 8;

/**
 * A five-second unskippable sponsor message with two close buttons.
 *
 * The 32px ✕ in the top right restarts the countdown. The 6px ✕ in the top
 * left actually closes it. Every instinct, every piece of visual hierarchy and
 * every learned habit points at the wrong one — which is the joke, and also a
 * completely straight description of the mobile web.
 *
 * Two mercies, both deliberate and neither signposted. Escape works. And the
 * tiny ✕ carries 24px of invisible padding: it *looks* six pixels, it *taps*
 * at twenty-four. We are cruel to the eyes, never to the thumbs — a six-pixel
 * tap target on a phone is not a joke, it is just a level nobody can finish.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [product] = useState(() => rng.pick(PRODUCTS));
  const [wait, setWait] = useState(FIRST_WAIT);
  const [left, setLeft] = useState(FIRST_WAIT);
  const [restarts, setRestarts] = useState(0);
  const [drift, setDrift] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [left]);

  /* Escape closes it. Nothing on screen says so, and it is the fastest exit in
     the level by several seconds. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      sfx.solve();
      onSolve();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSolve, sfx]);

  /*
   * The big ✕ leans toward the cursor — two pixels, capped.
   *
   * Small enough that nobody consciously sees it move, large enough that the
   * button is very slightly easier to hit than the one you actually want. It
   * is not there to make the level harder. It is there so that the wrong
   * choice feels, fractionally, like the button's idea.
   */
  const onPointerMove = (e: React.PointerEvent) => {
    const box = cardRef.current?.getBoundingClientRect();
    if (!box) return;
    const dx = e.clientX - (box.right - 26);
    const dy = e.clientY - (box.top + 26);
    const len = Math.hypot(dx, dy) || 1;
    setDrift({ x: (dx / len) * 2, y: (dy / len) * 2 });
  };

  const bigClose = () => {
    sfx.fail();
    onFail("wrong-close");
    const next = restarts + 1;
    setRestarts(next);
    /* Twice and it gets longer. Once is an accident; twice is a habit, and the
       ad is happy to reinforce it. */
    const w = next >= 2 ? PUNISHED_WAIT : FIRST_WAIT;
    setWait(w);
    setLeft(w);
  };

  const tinyClose = () => {
    if (left > 0) {
      sfx.thud();
      return;
    }
    sfx.solve();
    onSolve();
  };

  return (
    <SlopCard>
      <div className={s.ad} ref={cardRef} onPointerMove={onPointerMove}>
        <button
          type="button"
          className={s.tiny}
          aria-label="Close advertisement"
          onClick={tinyClose}
        >
          <span aria-hidden="true">✕</span>
        </button>

        <button
          type="button"
          className={s.big}
          aria-label="Close ad"
          style={{ transform: `translate(${drift.x}px, ${drift.y}px)` }}
          onClick={bigClose}
        >
          ✕
        </button>

        <div className={s.sponsor}>Sponsored</div>
        <div className={s.logo} aria-hidden="true">
          {product.name.slice(0, 1)}
        </div>
        <h3 className={s.name}>{product.name}</h3>
        <p className={s.pitch}>{product.pitch}</p>
        <div className={s.fakeCta}>Start free trial</div>

        <div className={s.timer} role="status">
          {left > 0 ? `Your content continues in ${left}…` : "Thanks for watching! ✨"}
        </div>
        {restarts > 0 && (
          <div className={s.restarted}>
            Ad restarted ({restarts}) · now {wait}s
          </div>
        )}
      </div>
    </SlopCard>
  );
}

export const L09: LevelModule = { meta, Component };
