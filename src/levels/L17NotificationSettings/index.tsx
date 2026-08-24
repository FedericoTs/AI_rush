"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const SPAWN_MS = 1400;
const MAX_ON_SCREEN = 9;

const NOISE = [
  "Your weekly summary is ready ✨",
  "3 people viewed your profile",
  "New feature: AI-powered folders 🚀",
  "You have unused credits!",
  "Someone reacted to your comment",
  "Reminder: complete your profile",
  "Your plan renews in 27 days",
  "Tips to get the most from your workspace",
] as const;

interface Toast { id: number; text: string }

/**
 * Whack-a-mole you cannot win, next to a switch that ends it.
 *
 * Toasts pile over the Submit button. Each has a dismiss ✕, and dismissing one
 * spawns roughly one and a half more — so the stack grows faster than anybody
 * can clear it, and clearing is exactly what everybody tries.
 *
 * The bell in the level's own header is a mute toggle and it stops generation
 * entirely. It has been visible since the first frame.
 *
 * No fail state: the button is simply unreachable until the bell is found,
 * which makes the whole level one realisation rather than a skill check.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [muted, setMuted] = useState(false);
  const [sub] = useState(() => slopSubhead(rng));
  /* A ref, not state: ids are bookkeeping, nothing renders from them, and
     deriving them inside a setState updater would be a side effect in a
     function React is allowed to call more than once. */
  const nextId = useRef(0);

  useEffect(() => {
    if (muted) return;
    const id = setInterval(() => {
      const toast = { id: nextId.current++, text: rng.pick(NOISE) };
      setToasts((t) => (t.length >= MAX_ON_SCREEN ? t : [...t, toast]));
    }, SPAWN_MS);
    return () => clearInterval(id);
  }, [muted, rng]);

  const dismiss = (id: number) => {
    sfx.blip();
    setToasts((t) => t.filter((x) => x.id !== id));
    if (muted) return;
    /* One and a half more, on average. The half is the seed's business. */
    const spawn = rng.chance(0.5) ? 2 : 1;
    const fresh = Array.from({ length: spawn }, () => ({
      id: nextId.current++,
      text: rng.pick(NOISE),
    }));
    setToasts((t) => [...t, ...fresh.slice(0, Math.max(0, MAX_ON_SCREEN - t.length))]);
  };

  return (
    <SlopCard>
      <div className={s.bar}>
        <SlopBadge>Settings · Blazing Fast</SlopBadge>
        <span className={s.sp} />
        <button
          type="button"
          className={`${s.bell} ${muted ? s.bellOff : ""}`}
          onClick={() => { setMuted((m) => !m); sfx.click(); }}
          aria-pressed={muted}
          aria-label={muted ? "Unmute notifications" : "Mute notifications"}
          data-testid="bell"
        >
          {muted ? "🔕" : "🔔"}
        </button>
      </div>

      <SlopHeading>Notification Settings 🔔</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.stage}>
        <div className={s.form}>
          <label className={s.row}>
            <input type="checkbox" defaultChecked /> Email me about everything
          </label>
          <label className={s.row}>
            <input type="checkbox" defaultChecked /> Also send a push notification
          </label>
          <label className={s.row}>
            <input type="checkbox" defaultChecked /> And an SMS, to be safe
          </label>
          <div className={s.ctaSlot}>
            <SlopCta onClick={onSolve}>Save Preferences</SlopCta>
          </div>
        </div>

        <div className={s.toasts} data-testid="toasts">
          {toasts.map((t, i) => (
            <div className={s.toast} key={t.id} style={{ transform: `translateY(${i * -4}px)` }}>
              <span>{t.text}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                data-testid={`dismiss-${t.id}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <SlopHint>
        You can dismiss notifications individually. We&apos;ll keep you up to date. 📬
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L17: LevelModule = { meta, Component };
