"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const NEEDED = 7;
/** How much mean brightness has to jump to count as a blink. */
const DELTA = 0.055;
/** Nothing for this long and the counter goes back to zero. */
const IDLE_RESET_MS = 4000;

const FACE = [
  "   .-\"\"\"\"\"\"\"-.   ",
  "  /           \\  ",
  " |   O     O   | ",
  " |      ^      | ",
  " |   \\_____/   | ",
  "  \\           /  ",
  "   '-.......-'   ",
];

/**
 * Seven of something, and a face outline that is upside down.
 *
 * The counter is a brightness-delta counter and nothing else. There is no face
 * detection here and there never was — which means blinking works, waving works,
 * and putting a finger over the lens works, and the moment a player realises
 * the third one counts is one of the better moments in the game. We are not
 * going to take that away by adding real detection.
 */
function Counter({
  count,
  needed,
  drift,
  heading,
  sub,
  note,
  reset,
  children,
}: {
  count: number;
  needed: number;
  drift: number;
  heading: string;
  sub: string;
  note: string;
  reset: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <SlopBadge>Identity · SOC2 (pending)</SlopBadge>
      <SlopHeading>{heading}</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.frame}>
        {children}

        {/*
          * The guide. Upside down, and drifting.
          *
          * It does nothing — the counter never looks at where anything is. It
          * is here because every identity check has one, and because trying to
          * line your face up with it is the twelve seconds before you notice
          * that lining anything up was never asked for.
          */}
        <span
          className={s.outline}
          style={{ transform: `translate(-50%, -50%) rotate(180deg) translateX(${drift}px)` }}
          aria-hidden="true"
        />
      </div>

      <div className={s.counterRow}>
        <div className={s.pips} data-testid="l19-count" aria-label={`${count} of ${needed}`}>
          {Array.from({ length: needed }, (_, i) => (
            <span key={i} className={`${s.pip} ${i < count ? s.pipOn : ""}`} />
          ))}
        </div>
        <span className={s.counterNum}>
          {count}/{needed}
        </span>
      </div>

      <SlopError>{reset ? "Liveness check timed out. Starting again. 📷" : null}</SlopError>
      <p className={s.note}>{note}</p>
      <SlopFooter links={FOOTER_LINKS} />
    </>
  );
}

/** Drift for the guide outline. Slow, pointless, present in every one of these. */
function useDrift() {
  const [drift, setDrift] = useState(0);
  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t += 0.06;
      setDrift(Math.sin(t) * 14);
    }, 60);
    return () => clearInterval(id);
  }, []);
  return drift;
}

/** The camera path. */
function Component({ input, onSolve, onFail, rng, sfx }: LevelProps) {
  const [count, setCount] = useState(0);
  const [reset, setReset] = useState(false);
  const [sub] = useState(() => slopSubhead(rng));
  const drift = useDrift();
  const holder = useRef<HTMLDivElement | null>(null);
  const last = useRef<number | null>(null);
  const lastHit = useRef(0);
  const clock = useRef(0);
  const done = useRef(false);

  /* Show the player their own camera. The adapter already owns the stream and
     the element; borrowing it beats opening a second one. */
  useEffect(() => {
    const cam = input.camera as (typeof input.camera & {
      video?: HTMLVideoElement | null;
    }) | null;
    const video = cam?.video;
    const box = holder.current;
    if (!video || !box) return;
    /* Moved, never restyled: the element belongs to the adapter, and the
       holder's stylesheet dresses it from the outside. */
    box.appendChild(video);
    return () => {
      if (video.parentElement === box) box.removeChild(video);
    };
  }, [input]);

  useEffect(() => {
    const cam = input.camera;
    if (!cam) return;
    return cam.subscribe(({ brightness }) => {
      if (done.current) return;
      const prev = last.current;
      last.current = brightness;
      if (prev === null) return;

      if (Math.abs(brightness - prev) >= DELTA) {
        lastHit.current = clock.current;
        setReset(false);
        setCount((n) => {
          const next = n + 1;
          if (next >= NEEDED && !done.current) {
            done.current = true;
            sfx.solve();
            onSolve();
          } else {
            sfx.blip();
          }
          return Math.min(NEEDED, next);
        });
      }
    });
  }, [input.camera, onSolve, sfx]);

  useEffect(() => {
    const id = setInterval(() => {
      clock.current += 250;
      if (done.current) return;
      if (clock.current - lastHit.current >= IDLE_RESET_MS) {
        lastHit.current = clock.current;
        setCount((n) => {
          if (n === 0) return 0;
          setReset(true);
          onFail("timed-out");
          return 0;
        });
      }
    }, 250);
    return () => clearInterval(id);
  }, [onFail]);

  return (
    <SlopCard>
      <Counter
        count={count}
        needed={NEEDED}
        drift={drift}
        reset={reset}
        sub={sub}
        heading="Position your face in the frame 📷"
        note="Blink seven times so we know you are alive. Or wave. Or, and we are not going to stop you, put a finger over the lens."
      >
        <div className={s.videoHolder} ref={holder} data-testid="l19-video" />
      </Counter>
    </SlopCard>
  );
}

/**
 * No camera, or permission declined.
 *
 * An ASCII face turns up and you click its eyes seven times. This is funnier
 * than the real level and we are entirely at peace with players preferring it.
 */
function Fallback({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [count, setCount] = useState(0);
  const [reset, setReset] = useState(false);
  const [sub] = useState(() => slopSubhead(rng));
  const drift = useDrift();
  const done = useRef(false);
  const lastHit = useRef(0);
  const clock = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      clock.current += 250;
      if (done.current) return;
      if (clock.current - lastHit.current >= IDLE_RESET_MS) {
        lastHit.current = clock.current;
        setCount((n) => {
          if (n === 0) return 0;
          setReset(true);
          onFail("timed-out");
          return 0;
        });
      }
    }, 250);
    return () => clearInterval(id);
  }, [onFail]);

  const blink = () => {
    if (done.current) return;
    lastHit.current = clock.current;
    setReset(false);
    setCount((n) => {
      const next = n + 1;
      if (next >= NEEDED && !done.current) {
        done.current = true;
        sfx.solve();
        onSolve();
      } else {
        sfx.blip();
      }
      return Math.min(NEEDED, next);
    });
  };

  return (
    <SlopCard>
      <Counter
        count={count}
        needed={NEEDED}
        drift={drift}
        reset={reset}
        sub={sub}
        heading="Position your face in the frame 📷"
        note="No camera, so here is a face. Click its eyes seven times. Yes, really."
      >
        <pre className={s.ascii} aria-hidden="true">
          {FACE.join("\n")}
        </pre>
        <button type="button" className={`${s.eye} ${s.eyeL}`} aria-label="Blink the left eye" onClick={blink} />
        <button type="button" className={`${s.eye} ${s.eyeR}`} aria-label="Blink the right eye" onClick={blink} />
      </Counter>
    </SlopCard>
  );
}

export const L19: LevelModule = { meta, Component, Fallback };
