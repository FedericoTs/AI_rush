"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading } from "@/ui/slop/Slop";
import { FOOTER_LINKS } from "@/ui/slop/phrases";
import s from "./styles.module.css";

/**
 * Gravity alone reads about 9.8. Moving about reads more.
 *
 * The threshold is set where standing up and turning round comfortably clears
 * it and waggling the phone on a desk does not — but it is not a fraud
 * detector and it is not trying to be. Somebody determined to shake their way
 * past this has stood up in spirit.
 */
const MOVING_MS2 = 12.5;
/** How long that has to be sustained. Standing and turning takes about this. */
const REQUIRED_MS = 4500;
/** Stop moving for this long and it decides you sat back down. */
const STALL_MS = 1600;
const STEP_MS = 100;

/** The honour system needs long enough to actually do it, and no longer. */
const HONOUR_MS = 6000;

/**
 * "For your security, please stand up and rotate 360°."
 *
 * And it means it. The accelerometer is read, the magnitude and the duration
 * correspond to actually standing and turning around, and there is no way to
 * pass it from a chair that is meaningfully easier than just standing up.
 *
 * This is the level people film.
 */
function Component({ onSolve, onFail, sfx, input }: LevelProps) {
  const [progress, setProgress] = useState(0);
  const [magnitude, setMagnitude] = useState(0);
  const [seated, setSeated] = useState(false);
  const mag = useRef(0);
  const still = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    const motion = input.motion;
    if (!motion) return;
    return motion.subscribe((m) => {
      mag.current = m.magnitude;
      setMagnitude(m.magnitude);
    });
  }, [input.motion]);

  /* Progress lives in a ref, state is a copy for the screen. Deciding
     "that is enough" inside a state updater lets a batch of queued ticks each
     call onSolve, which the engine would happily score as six levels. */
  const moved = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (done.current) return;

      if (mag.current > MOVING_MS2) {
        still.current = 0;
        moved.current += STEP_MS;
        setProgress(moved.current);
        if (moved.current >= REQUIRED_MS) {
          done.current = true;
          sfx.solve();
          onSolve();
        }
        return;
      }

      still.current += STEP_MS;
      /* Only accuse somebody of sitting down if they had started. */
      if (still.current >= STALL_MS && moved.current > 0) {
        still.current = 0;
        moved.current = 0;
        setProgress(0);
        setSeated(true);
        onFail("seated");
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [onSolve, onFail, sfx]);

  return (
    <SlopCard>
      <SlopBadge>Liveness · Enterprise-Grade</SlopBadge>
      <SlopHeading>Please stand up 🧍</SlopHeading>

      <p className={s.ask}>
        For your security, please stand up and rotate 360°. This confirms you are a person and not
        an automated system.
      </p>

      <div className={s.gauge}>
        <div className={s.ring}>
          <div className={s.needle} style={{ transform: `rotate(${(progress / REQUIRED_MS) * 360}deg)` }} />
          <span className={s.ringText} data-testid="l35-progress">
            {Math.min(100, Math.round((progress / REQUIRED_MS) * 100))}%
          </span>
        </div>
        <div className={s.readout}>
          <span className={s.readLabel}>Accelerometer</span>
          <span className={s.readValue} data-testid="l35-magnitude">
            {magnitude.toFixed(1)} m/s²
          </span>
          <span className={s.readNote}>
            {magnitude > MOVING_MS2 ? "Movement detected. Keep going." : "Awaiting movement."}
          </span>
        </div>
      </div>

      <SlopError>{seated ? "We detected that you are still seated. 🪑" : null}</SlopError>
      <p className={s.note}>
        Yes, in public. We appreciate your cooperation.
      </p>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

/**
 * No accelerometer, or permission declined.
 *
 * So it asks you to stand up anyway and believes you. Six seconds, a checkbox,
 * and nothing whatsoever verifying any of it — which is a much better joke
 * than the sensor version and, on a laptop, the only version that makes sense.
 * Ticking the box without standing up is available to everyone and costs
 * nothing. It is between you and the form.
 */
function Fallback({ onSolve, sfx }: LevelProps) {
  const [left, setLeft] = useState(HONOUR_MS);
  const [stood, setStood] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setLeft((ms) => Math.max(0, ms - 100)), 100);
    return () => clearInterval(id);
  }, [left]);

  const ready = left <= 0;

  return (
    <SlopCard>
      <SlopBadge>Liveness · Enterprise-Grade</SlopBadge>
      <SlopHeading>Please stand up 🧍</SlopHeading>

      <p className={s.ask}>
        Your device cannot detect standing. Please stand up anyway. We trust you.
      </p>

      <div className={s.honour}>
        <div className={s.count} data-testid="l35-countdown">
          {(left / 1000).toFixed(1)}s
        </div>
        <div className={s.track}>
          <div className={s.fill} style={{ width: `${100 - (left / HONOUR_MS) * 100}%` }} />
        </div>
      </div>

      <label className={s.check}>
        <input
          type="checkbox"
          checked={stood}
          disabled={!ready}
          onChange={(e) => {
            setStood(e.target.checked);
            sfx.click();
          }}
        />
        I stood up.
      </label>

      <button
        type="button"
        className={s.cta}
        disabled={!stood}
        onClick={() => {
          sfx.solve();
          onSolve();
        }}
      >
        Confirm
      </button>

      <p className={s.note}>
        There is nothing checking this. There was never going to be. 🫡
      </p>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L35: LevelModule = { meta, Component, Fallback };
