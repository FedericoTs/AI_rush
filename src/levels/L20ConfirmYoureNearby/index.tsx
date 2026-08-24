"use client";

import { useEffect, useRef, useState } from "react";
import { useLatest } from "@/ui/useLatest";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopFooter, SlopHeading, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const HOLD_MS = 3000;
const STEP_MS = 50;
const NEEDED = 3;
/** Popups are this wide, which is what makes the corners work. */
const POPUP_W = 200;

interface Popup {
  id: number;
  x: number;
  y: number;
}

/**
 * The three-second hold, shared by both paths.
 *
 * `held` is however many of the three inputs are currently down. On a phone
 * that is fingers; on a laptop it is left button, right button and the space
 * bar. The rule is the same either way and so is the par: hold all three for
 * three seconds, and losing any one of them starts the clock over.
 */
function Hold({
  held,
  heading,
  note,
  onSolve,
  onFail,
  rng,
  sfx,
  children,
}: {
  held: number;
  heading: string;
  note: string;
  onSolve: () => void;
  onFail: (reason?: string) => void;
  rng: LevelProps["rng"];
  sfx: LevelProps["sfx"];
  children?: React.ReactNode;
}) {
  const [ms, setMs] = useState(0);
  const [sub] = useState(() => slopSubhead(rng));
  const done = useRef(false);
  const prevHeld = useRef(held);
  const heldRef = useLatest(held);
  const cbs = useLatest({ onSolve, onFail, sfx });

  /* The count lives in a ref and state is a copy for the screen — deciding
     "that was three seconds" inside a state updater lets a batch of queued
     ticks each call onSolve. */
  const heldMs = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (done.current) return;

      if (heldRef.current < NEEDED) {
        /* Only complain about a hold that had actually started. Lifting a
           finger you never put down is not a mistake. */
        if (heldMs.current > 0 && prevHeld.current >= NEEDED) {
          cbs.current.sfx.thud();
          cbs.current.onFail("lifted");
        }
        prevHeld.current = heldRef.current;
        if (heldMs.current !== 0) {
          heldMs.current = 0;
          setMs(0);
        }
        return;
      }

      prevHeld.current = heldRef.current;
      heldMs.current += STEP_MS;
      setMs(heldMs.current);
      if (heldMs.current >= HOLD_MS) {
        done.current = true;
        cbs.current.sfx.solve();
        cbs.current.onSolve();
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [cbs, heldRef]);

  return (
    <SlopCard>
      <SlopBadge>Presence · Zero-Trust</SlopBadge>
      <SlopHeading>{heading}</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      {children}

      <div className={s.status}>
        <span className={s.dots} data-testid="l20-held">
          {Array.from({ length: NEEDED }, (_, i) => (
            <span key={i} className={`${s.dot} ${i < held ? s.dotOn : ""}`} />
          ))}
        </span>
        <span className={s.timer}>{(ms / 1000).toFixed(1)}s / 3.0s</span>
      </div>
      <div className={s.track}>
        <div className={s.fill} style={{ width: `${(ms / HOLD_MS) * 100}%` }} />
      </div>

      <p className={s.note}>{note}</p>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

/**
 * Three fingers on the sensor, and the sensor is the whole screen.
 *
 * A popup spawns centred on wherever a finger lands, two hundred pixels wide,
 * and popups eat the touch underneath them. Landing in the middle is how you
 * lose; landing in the corners pushes each popup mostly off the edge where it
 * cannot intercept anything. That is the honest solve and nothing says so.
 */
function Component(props: LevelProps) {
  const [down, setDown] = useState<number[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const pad = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(0);

  const onDown = (e: React.PointerEvent) => {
    const box = pad.current?.getBoundingClientRect();
    if (!box) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDown((ids) => (ids.includes(e.pointerId) ? ids : [...ids, e.pointerId]));

    const id = nextId.current++;
    setPopups((p) => [...p, { id, x: e.clientX - box.left, y: e.clientY - box.top }]);
    props.sfx.click();
    setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), 2600);
  };

  const onUp = (e: React.PointerEvent) => {
    setDown((ids) => ids.filter((i) => i !== e.pointerId));
  };

  return (
    <Hold
      held={down.length}
      heading="Confirm you're nearby 🫆"
      note="Place three fingers on the sensor and hold. The sensor is the whole panel."
      onSolve={props.onSolve}
      onFail={props.onFail}
      rng={props.rng}
      sfx={props.sfx}
    >
      <div
        className={s.pad}
        ref={pad}
        data-testid="l20-pad"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <span className={s.padLabel}>SENSOR</span>
        {popups.map((p) => (
          <div
            className={s.popup}
            key={p.id}
            style={{ left: p.x - POPUP_W / 2, top: p.y - 34 }}
            /* It eats the touch under it. That is the entire mechanism. */
            onPointerDown={(e) => e.stopPropagation()}
          >
            Did you know? You can enable passkeys in Settings. ✨
          </div>
        ))}
      </div>
    </Hold>
  );
}

/**
 * One pointer, no multi-touch.
 *
 * Left button, right button and the space bar, all at once. Same three-input
 * coordination problem, same three seconds — and the right-click menu is
 * suppressed inside the panel, because losing the level to a context menu
 * would be a bug rather than a joke.
 */
function Fallback(props: LevelProps) {
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [space, setSpace] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      setSpace(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const up = () => {
      setLeft(false);
      setRight(false);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  return (
    <Hold
      held={[left, right, space].filter(Boolean).length}
      heading="Confirm you're nearby 🫆"
      note="No touchscreen, so: hold left click, right click and the space bar together for three seconds."
      onSolve={props.onSolve}
      onFail={props.onFail}
      rng={props.rng}
      sfx={props.sfx}
    >
      <div
        className={s.pad}
        data-testid="l20-pad"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button === 0) setLeft(true);
          if (e.button === 2) setRight(true);
          props.sfx.click();
        }}
      >
        <span className={s.padLabel}>SENSOR</span>
        <div className={s.keys}>
          <span className={`${s.key} ${left ? s.keyOn : ""}`} data-key="left">
            left click
          </span>
          <span className={`${s.key} ${right ? s.keyOn : ""}`} data-key="right">
            right click
          </span>
          <span className={`${s.key} ${space ? s.keyOn : ""}`} data-key="space">
            space
          </span>
        </div>
      </div>
    </Hold>
  );
}

export const L20: LevelModule = { meta, Component, Fallback };
