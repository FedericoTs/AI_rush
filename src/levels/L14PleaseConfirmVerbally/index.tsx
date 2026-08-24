"use client";

import { useEffect, useRef, useState } from "react";
import { useLatest } from "@/ui/useLatest";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

/** Hold it here for three seconds. Narrow on purpose, never impossible. */
const BAND_LOW = 0.62;
const BAND_HIGH = 0.78;
const HOLD_MS = 3000;
const STEP_MS = 50;
/** Each failed attempt narrows the band. Three times, then it stops. */
const MAX_NARROWINGS = 3;
const NARROW_BY = 0.1;
/** No signal at all for this long and we stop pretending the mic works. */
const DEAD_MIC_MS = 4000;

/**
 * The meter, and the three seconds.
 *
 * Shared by the microphone path and the hold-a-slider path, because they are
 * the same level: one number between nought and one goes in, and everything
 * after that is identical. A fallback written separately from its level drifts
 * apart from it in difficulty within two changes, and then some players are
 * quietly playing a worse game.
 */
function Meter({
  level,
  onSolve,
  onFail,
  rng,
  sfx,
  heading,
  note,
  children,
}: {
  level: number;
  onSolve: () => void;
  onFail: (reason?: string) => void;
  rng: LevelProps["rng"];
  sfx: LevelProps["sfx"];
  heading: string;
  note: string;
  children?: React.ReactNode;
}) {
  const [held, setHeld] = useState(0);
  const [narrowings, setNarrowings] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));
  const done = useRef(false);
  const levelRef = useLatest(level);

  const shrink = (narrowings * NARROW_BY * (BAND_HIGH - BAND_LOW)) / 2;
  const low = BAND_LOW + shrink;
  const high = BAND_HIGH - shrink;

  const cbs = useLatest({ onSolve, onFail, sfx });
  const band = useLatest({ low, high });

  /*
   * The hold lives in a ref; React is told about it for rendering.
   *
   * Deciding "that was three seconds" inside a state updater is what queued
   * five onSolve calls in a row — several ticks land inside one React batch
   * and every updater then runs against the same stale flag. The timer owns
   * the count, state is a copy for the screen.
   */
  const heldMs = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (done.current) return;
      const v = levelRef.current;

      /* Above the band is not "nearly there", it is a reset. Shouting is the
         first thing everybody does and the level has to have an opinion. */
      if (v > band.current.high) {
        if (heldMs.current > 0) {
          heldMs.current = 0;
          setHeld(0);
          cbs.current.sfx.fail();
          cbs.current.onFail("too-loud");
          setError("PLEASE DO NOT SHOUT AT THE FORM.");
          setNarrowings((n) => Math.min(MAX_NARROWINGS, n + 1));
        }
        return;
      }
      if (v < band.current.low) {
        if (heldMs.current !== 0) {
          heldMs.current = 0;
          setHeld(0);
        }
        return;
      }

      heldMs.current += STEP_MS;
      setHeld(heldMs.current);
      if (heldMs.current >= HOLD_MS) {
        done.current = true;
        cbs.current.sfx.solve();
        cbs.current.onSolve();
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [band, cbs, levelRef]);

  const inBand = level >= low && level <= high;

  return (
    <SlopCard>
      <SlopBadge>Identity · Bank-Level Security</SlopBadge>
      <SlopHeading>{heading}</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.meterWrap}>
        <div className={s.meter} data-testid="l14-meter">
          {/* The safe band, drawn where it actually is. */}
          <div
            className={s.band}
            style={{ bottom: `${low * 100}%`, height: `${(high - low) * 100}%` }}
          />
          <div
            className={`${s.fill} ${inBand ? s.fillOk : ""}`}
            style={{ height: `${Math.min(100, level * 100)}%` }}
            data-in-band={inBand ? "yes" : "no"}
          />
        </div>

        <div className={s.side}>
          <div className={s.holdLabel}>Hold</div>
          <div className={s.hold} data-testid="l14-held">
            {(held / 1000).toFixed(1)}s
          </div>
          <div className={s.holdTrack}>
            <div className={s.holdFill} style={{ width: `${(held / HOLD_MS) * 100}%` }} />
          </div>
          <div className={s.of}>of 3.0s</div>
        </div>
      </div>

      {children}

      <SlopError>{error}</SlopError>
      <p className={s.note}>{note}</p>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

/** Hold a steady hum. Not loud. Sustained. */
function Component(props: LevelProps) {
  const [rms, setRms] = useState(0);
  const [deadMic, setDeadMic] = useState(false);
  const lastSignal = useRef(0);
  const elapsed = useRef(0);

  useEffect(() => {
    const mic = props.input.audioIn;
    if (!mic) return;
    return mic.subscribe((a) => {
      if (a.rms > 0.02) lastSignal.current = elapsed.current;
      setRms(a.rms);
    });
  }, [props.input.audioIn]);

  /*
   * A granted-but-dead microphone is common — muted hardware, an OS-level
   * block, a virtual device that reports nothing. Leaving a player holding a
   * hum at a meter that can never move is the single worst thing this level
   * could do, so four seconds of pure silence hands them the fallback and says
   * so kindly. It is not their fault and the level should not imply it is.
   */
  useEffect(() => {
    const id = setInterval(() => {
      elapsed.current += 250;
      if (elapsed.current - lastSignal.current >= DEAD_MIC_MS) setDeadMic(true);
    }, 250);
    return () => clearInterval(id);
  }, []);

  if (deadMic) {
    return (
      <>
        <div className={s.toast} role="status">
          We couldn&rsquo;t hear you. That&rsquo;s okay. 💜
        </div>
        <Fallback {...props} />
      </>
    );
  }

  return (
    <Meter
      level={rms}
      onSolve={props.onSolve}
      onFail={props.onFail}
      rng={props.rng}
      sfx={props.sfx}
      heading="Say something. Calmly. 🎤"
      note="Hold your voice inside the green band for three seconds. A steady hum works better than words."
    />
  );
}

/**
 * No microphone, permission declined, or a mic that turned out to be dead.
 *
 * The meter becomes a slider that falls on its own, and you have to hold it in
 * the band with a finger. Same band, same three seconds, same par — and no
 * quieter to play in a room full of people, which some players will prefer and
 * which is entirely fine.
 */
function Fallback(props: LevelProps) {
  const [value, setValue] = useState(0.3);

  /* It drifts down. Holding a slider still is not a challenge; holding one
     that is trying to leave is exactly the same problem as holding a note. */
  useEffect(() => {
    const id = setInterval(() => {
      setValue((v) => Math.max(0, v - 0.012));
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <Meter
      level={value}
      onSolve={props.onSolve}
      onFail={props.onFail}
      rng={props.rng}
      sfx={props.sfx}
      heading="Confirm your presence 🎚️"
      note="No microphone, so hold it by hand. The slider falls on its own — keep it in the band."
    >
      <input
        className={s.slider}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-label="Signal level"
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </Meter>
  );
}

export const L14: LevelModule = { meta, Component, Fallback };
