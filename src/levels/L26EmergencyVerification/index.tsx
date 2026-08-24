"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading } from "@/ui/slop/Slop";
import { FOOTER_LINKS } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const SHORT_MS = 160;
const LONG_MS = 460;
const GAP_MS = 220;
/** Rhythm input is genuinely hard. Be generous, and say so. */
const TOLERANCE_MS = 150;
const REPLAYS = 2;

export type Beat = "short" | "long";

export const beatMs = (b: Beat) => (b === "short" ? SHORT_MS : LONG_MS);

/**
 * Was that the same rhythm?
 *
 * Compares durations, not absolute times, so somebody who starts late but taps
 * the right pattern passes — which is the thing being tested. Exported because
 * the tolerance is the difference between "hard" and "unfair" and it deserves
 * a test that does not need a browser.
 */
export function matches(pattern: readonly Beat[], taps: readonly number[]): boolean {
  if (taps.length !== pattern.length) return false;
  return pattern.every((b, i) => Math.abs(taps[i]! - beatMs(b)) <= TOLERANCE_MS);
}

/** Three short, two long — then longer every time you get it wrong. */
function makePattern(rng: LevelProps["rng"], round: number): Beat[] {
  const base: Beat[] = ["short", "short", "short", "long", "long"];
  if (round === 0) return base;
  return [...base, ...Array.from({ length: round }, () => (rng.chance(0.5) ? "short" : "long") as Beat)];
}

/**
 * Your device buzzes a rhythm. Tap it back.
 *
 * Three short, two long, played twice and then never again. The tolerance is
 * ±150ms, which is generous on purpose: reproducing a rhythm is a genuinely
 * hard thing to ask of somebody and the level is meant to be funny rather than
 * a musicianship test.
 *
 * On a device that can vibrate, it vibrates. On every iPhone ever made it
 * flashes the panel and pulses a tone instead — and that is not a degraded
 * path, it is the majority path, built first and identical in difficulty. The
 * haptics adapter tells the level which it got; nothing else changes.
 */
function Component({ onSolve, onFail, rng, sfx, input }: LevelProps) {
  const [round, setRound] = useState(0);
  const [pattern, setPattern] = useState<Beat[]>(() => makePattern(rng, 0));
  /* Starts true because the pattern plays the instant you arrive. Having the
     initial value already be "playing" is what lets the mount effect schedule
     the timers without setting state synchronously inside an effect. */
  const [playing, setPlaying] = useState(true);
  const [flash, setFlash] = useState(false);
  const [replaysLeft, setReplaysLeft] = useState(REPLAYS - 1);
  const [taps, setTaps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const downAt = useRef(0);
  const timers = useRef<number[]>([]);
  const done = useRef(false);

  const haptic = input.haptics?.available ?? false;

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );

  /**
   * Play the pattern, whichever way this device can receive it.
   *
   * The vibrate call and the visual pulse run off the same schedule, so the
   * two deliveries are the same length and the same rhythm — a player on an
   * iPhone is being asked the identical question.
   */
  const schedule = useCallback(
    (p: readonly Beat[]) => {
      if (haptic) {
        const ms: number[] = [];
        p.forEach((b, i) => {
          if (i > 0) ms.push(GAP_MS);
          ms.push(beatMs(b));
        });
        input.haptics.pattern(ms);
      }

      let at = 0;
      p.forEach((b, i) => {
        const on = window.setTimeout(() => {
          setFlash(true);
          sfx.thud();
        }, at);
        const off = window.setTimeout(() => setFlash(false), at + beatMs(b));
        timers.current.push(on, off);
        at += beatMs(b) + (i < p.length - 1 ? GAP_MS : 0);
      });

      timers.current.push(window.setTimeout(() => setPlaying(false), at + 120));
    },
    [haptic, input.haptics, sfx],
  );

  /** Everything a replay needs. Only ever called from an event handler. */
  const play = useCallback(
    (p: readonly Beat[]) => {
      setPlaying(true);
      setTaps([]);
      schedule(p);
    },
    [schedule],
  );

  /* Played once on arrival, without being asked for. Only schedules timers —
     `playing` is already true, so nothing is set synchronously here. */
  useEffect(() => {
    schedule(pattern);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tapDown = () => {
    if (playing || done.current) return;
    downAt.current = performance.now();
  };

  const tapUp = () => {
    if (playing || done.current || downAt.current === 0) return;
    const held = performance.now() - downAt.current;
    downAt.current = 0;
    sfx.blip();

    const next = [...taps, held];
    setTaps(next);
    if (next.length < pattern.length) return;

    if (matches(pattern, next)) {
      done.current = true;
      sfx.solve();
      onSolve();
      return;
    }

    sfx.fail();
    onFail("wrong-rhythm");
    setError("That wasn't it. For your security, here is a longer one. 🔐");

    const r = round + 1;
    const longer = makePattern(rng, r);
    setRound(r);
    setPattern(longer);
    setReplaysLeft(REPLAYS - 1);
    /* And play it. A new pattern the player never hears is not a level. */
    play(longer);
  };

  return (
    <SlopCard>
      <SlopBadge>Security · Zero-Trust</SlopBadge>
      <SlopHeading>Emergency verification 🚨</SlopHeading>

      <p className={s.ask}>
        We sent a pattern to this device. Tap it back to confirm it was you.
      </p>

      <div className={`${s.stage} ${flash ? s.stageFlash : ""}`} data-testid="l26-stage">
        <button
          type="button"
          className={s.pad}
          data-testid="l26-pad"
          disabled={playing}
          onPointerDown={tapDown}
          onPointerUp={tapUp}
          onPointerLeave={() => (downAt.current = 0)}
        >
          {playing ? "…" : "TAP"}
        </button>
      </div>

      <div className={s.row}>
        <span className={s.progress} data-testid="l26-taps">
          {pattern.map((b, i) => (
            <span
              key={i}
              className={`${s.beat} ${b === "long" ? s.long : ""} ${i < taps.length ? s.beatDone : ""}`}
            />
          ))}
        </span>
        <button
          type="button"
          className={s.replay}
          disabled={playing || replaysLeft <= 0}
          onClick={() => {
            setReplaysLeft((n) => n - 1);
            play(pattern);
          }}
        >
          {replaysLeft > 0 ? `Replay (${replaysLeft})` : "No replays left"}
        </button>
      </div>

      <SlopError>{error}</SlopError>
      <p className={s.note}>
        {haptic
          ? "Your device buzzed it. Short taps for short buzzes, long for long."
          : "Your device can't vibrate, so we flashed and beeped it instead. Short taps for short flashes, long for long."}{" "}
        Timing is forgiving — within about a sixth of a second.
      </p>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L26: LevelModule = { meta, Component };
