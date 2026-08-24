"use client";

import { useEffect, useRef, useState } from "react";
import type { ModifierId } from "../types";
import s from "./chaos.module.css";

/**
 * The wrapper that actually draws the modifiers.
 *
 * Twelve modifiers, dealt from 2:00 onward, up to two at once. The rule that
 * shapes every decision in this file is from `LEVELS.md`:
 *
 *   > They compose over *any* level via a wrapper component and CSS variables —
 *   > no level implements a modifier itself.
 *
 * Which is not a style preference. `src/levels/**` is an ESLint sandbox with no
 * access to the store, the router or anything else outside its props, and 48
 * levels each hand-rolling twelve effects would be 576 places for one of them
 * to be wrong. So everything here works from the outside, through three stable
 * hooks on the shared chrome (`data-slop-card`, `data-slop-cta`,
 * `data-slop-microcopy`) and through CSS on a wrapper. Not one level knows a
 * modifier exists.
 *
 * ── The line this file does not cross ────────────────────────────────────
 *
 * **No modifier may drop or alter input.** `Lag` is the one that tempts you:
 * the obvious build is an overlay that swallows pointer events and re-dispatches
 * them 350ms later, and it breaks every drag level in the game — a synthetic
 * pointer stream is not a real one, and re-dispatched events do not focus
 * fields or type into them. L32 already writes the rule down for the level-
 * strength version of the same idea: *"Nothing is dropped, ever. A level that
 * lost input would be broken rather than slow."*
 *
 * So `Lag` and `Slippery` are built as **feedback** effects rather than input
 * effects: the screen answers late, and things that move overshoot. That is
 * what the player experiences either way, and it cannot make a level
 * unwinnable. Each is documented at its rule in `chaos.module.css`.
 *
 * ── Photosensitivity ─────────────────────────────────────────────────────
 *
 * `GAME_DESIGN.md`'s honesty clause is enforced in the CSS, not audited later:
 * `Rainbow` hue-rotates at 0.4 Hz and nothing anywhere strobes. Everything that
 * moves stops dead under `prefers-reduced-motion`, and the two that are purely
 * static — `Mirror`, `Rotate` — deliberately do not, because they are the
 * level's layout rather than motion.
 */

const POPUP_EVERY_MS = 8_000;
const CONFETTI_COUNT = 26;

const POPUP_LINES = [
  "Enjoying AI Rush? Rate us! ⭐",
  "You have 1 unread notification",
  "Get 20% off Pro — today only 🚀",
  "We've updated our Privacy Policy",
  "Join 40,000+ teams already using us ✨",
  "Your trial ends in 27 days",
] as const;

export interface ChaosProps {
  modifiers: readonly ModifierId[];
  /** The run's mute toggle. `Whisper` is the only modifier that can make noise. */
  muted?: boolean;
  children: React.ReactNode;
}

const has = (mods: readonly ModifierId[], id: ModifierId) => mods.includes(id);

export function ChaosProvider({ modifiers, muted = false, children }: ChaosProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  /* Where the player has dragged the card back to, under `Drift`. */
  const [nudge, setNudge] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const drifting = has(modifiers, "drift");
  const fleeing = has(modifiers, "fleeing");
  const popups = has(modifiers, "popups");
  const whisper = has(modifiers, "whisper");
  const confetti = has(modifiers, "confetti");

  /*
   * The fleeing CTA.
   *
   * Found from the outside by `data-slop-cta` and moved with a transform, so
   * the button keeps its place in the layout and its click target moves with
   * it — a CTA that dodged visually but stayed clickable where it used to be
   * would be a lie rather than a joke.
   *
   * Capped at 64px and eased by distance, so it is always catchable. This is
   * the mild version of L28; the level is the one allowed to be cruel.
   */
  useEffect(() => {
    if (!fleeing) return;
    const el = root.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const cta = el.querySelector<HTMLElement>("[data-slop-cta]");
      if (!cta) return;
      const box = cta.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const dx = cx - e.clientX;
      const dy = cy - e.clientY;
      const dist = Math.hypot(dx, dy);
      const reach = 140;
      if (dist > reach) {
        cta.style.transform = "";
        return;
      }
      const push = (1 - dist / reach) * 64;
      const k = dist === 0 ? 0 : push / dist;
      cta.style.transform = `translate(${(dx * k).toFixed(1)}px, ${(dy * k).toFixed(1)}px)`;
    };

    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      const cta = el.querySelector<HTMLElement>("[data-slop-cta]");
      if (cta) cta.style.transform = "";
    };
  }, [fleeing]);

  /*
   * A popup every eight seconds, in a corner the level is not using.
   *
   * Only ever one at a time: a queue of these would stop being an interruption
   * and start being a wall, and the modifier is meant to compose over levels
   * that are already hard rather than replace them.
   */
  const popupAt = useRef(0);
  useEffect(() => {
    if (!popups) return;
    const id = setInterval(() => {
      const line = POPUP_LINES[popupAt.current % POPUP_LINES.length]!;
      popupAt.current += 1;
      setPopup((cur) => cur ?? line);
    }, POPUP_EVERY_MS);
    return () => clearInterval(id);
  }, [popups]);

  /*
   * A synthesised voice reading the level's own microcopy, badly.
   *
   * Speech is the most intrusive thing in this file, so it obeys the run's mute
   * toggle, speaks once per level rather than looping, and is cancelled on
   * unmount — a voice that followed the player into the next level would be a
   * bug they could not turn off.
   */
  useEffect(() => {
    if (!whisper || muted) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const el = root.current;
    const text = el?.querySelector("[data-slop-microcopy]")?.textContent?.trim();
    if (!text) return;

    let cancelled = false;
    /* A beat after mount, so it reads what the level settled on. */
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 0.85;
        utter.pitch = 1.4;
        utter.volume = 0.7;
        window.speechSynthesis.speak(utter);
      } catch {
        /* No voices installed, or the browser refused. Silence is fine. */
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(t);
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* Nothing to cancel. */
      }
    };
  }, [whisper, muted]);

  /* Dragging the card back, which is the whole point of `Drift`. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (!drifting) return;
    /* Only from the gutter: grabbing the card itself would steal every click
       the level needs. */
    if ((e.target as HTMLElement).closest("[data-slop-card]")) return;
    drag.current = { x: e.clientX - nudge.x, y: e.clientY - nudge.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setNudge({ x: e.clientX - d.x, y: e.clientY - d.y });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  if (modifiers.length === 0) return <>{children}</>;

  return (
    <div
      ref={root}
      className={s.root}
      data-chaos={modifiers.join(" ")}
      data-testid="chaos"
      onPointerDown={drifting ? onPointerDown : undefined}
      onPointerMove={drifting ? onPointerMove : undefined}
      onPointerUp={drifting ? onPointerUp : undefined}
      onPointerCancel={drifting ? onPointerUp : undefined}
      style={
        {
          "--chaos-nudge-x": `${nudge.x}px`,
          "--chaos-nudge-y": `${nudge.y}px`,
        } as React.CSSProperties
      }
    >
      {/* Two layers, because `Drift` animates one and the player moves the
          other, and a single element cannot hold both transforms. */}
      <div className={s.drifter}>
        <div className={s.stage}>{children}</div>
      </div>

      {confetti && (
        <div className={s.confetti} aria-hidden="true">
          {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
            <i
              key={i}
              style={
                {
                  "--i": i,
                  left: `${(i * 37) % 100}%`,
                  animationDelay: `${((i * 13) % 40) / 10}s`,
                  animationDuration: `${3 + ((i * 7) % 30) / 10}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {popup && (
        <div className={s.popup} role="dialog" aria-label="Notice" data-testid="chaos-popup">
          <span>{popup}</span>
          <button type="button" onClick={() => setPopup(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
