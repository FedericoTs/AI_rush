"use client";

import { useEffect, useRef, useState } from "react";
import { useLatest } from "@/ui/useLatest";

/**
 * The tray, and the physics both paths share.
 *
 * The gyro path and the drag-it-with-a-mouse path are the same level: one
 * number goes in — how far the thing is tilted, in degrees — and everything
 * downstream of that is identical. That is not tidiness for its own sake. A
 * fallback built separately from its level drifts away from it in difficulty
 * within about two changes, and then the desktop player is playing a worse
 * game without anyone noticing.
 */

/** Past this, unseated digits slide out of the tray. */
export const SPILL_DEG = 34;
/** Under this, the tray is level enough for a digit to settle into a slot. */
export const SETTLE_DEG = 7;
/** How long a spilling tilt is tolerated before it actually spills. */
const SPILL_GRACE_MS = 320;
const REFILL_MS = 900;
const STEP_MS = 16;

/** Track width in abstract units. Slots sit at even intervals along it. */
const TRACK = 100;
const SLOT_TOLERANCE = 7;

export interface TrayState {
  /** Position along the track for each digit, or null once it is seated. */
  x: (number | null)[];
  seated: boolean[];
  spilling: boolean;
}

export function slotX(index: number, total: number): number {
  return ((index + 1) / (total + 1)) * TRACK;
}

/**
 * One physics step.
 *
 * Exported and pure so the honest solve can be proved without a browser: the
 * unit tests drive this with a tilt sequence and assert the digits arrive.
 */
export function step(state: TrayState, tiltDeg: number, dtMs: number): TrayState {
  const tilt = Math.max(-90, Math.min(90, tiltDeg));
  const level = Math.abs(tilt) < SETTLE_DEG;

  const x = [...state.x];
  const seated = [...state.seated];

  /*
   * One digit at a time.
   *
   * Only the leading unseated digit moves; the rest wait their turn at the
   * left. Moving all four together would stack them on one pixel and make the
   * tray unreadable, and "small tilts, one digit at a time" is the strategy
   * the level is actually asking for.
   */
  const lead = x.findIndex((at, i) => at !== null && at !== undefined && !seated[i]);
  if (lead < 0) return { x, seated, spilling: state.spilling };

  const at = x[lead]!;
  /* Speed rises with the sine of the tilt, so a small tilt is genuinely
     controllable and a large one is not. The lip is the flat bit near zero. */
  const moved = level ? at : at + Math.sin((tilt * Math.PI) / 180) * 46 * (dtMs / 1000);
  const clamped = Math.max(0, Math.min(TRACK, moved));

  const target = slotX(lead, x.length);
  if (level && Math.abs(clamped - target) <= SLOT_TOLERANCE) {
    x[lead] = null;
    seated[lead] = true;
  } else {
    x[lead] = clamped;
  }

  return { x, seated, spilling: state.spilling };
}

export function freshTray(count: number): TrayState {
  return {
    x: Array.from({ length: count }, () => 0),
    seated: Array.from({ length: count }, () => false),
    spilling: false,
  };
}

/**
 * Runs the physics on a timer and reports when every digit is home.
 *
 * A plain interval rather than requestAnimationFrame, deliberately: the step
 * is deterministic in dt, and an interval is drivable by fake timers, which is
 * what lets a test prove this level is winnable at all.
 */
export function useTray(
  digits: readonly string[],
  tilt: number,
  onDone: () => void,
  onSpill: () => void,
) {
  const [tray, setTray] = useState<TrayState>(() => freshTray(digits.length));
  const overTilt = useRef(0);
  const done = useRef(false);
  /*
   * Milliseconds left of the refill, and the reason it is a real lockout.
   *
   * `LEVELS.md` has always said "digits spill; tray refills after 1s", and
   * until now that second cost nothing: the spill reset the digits, set a
   * display flag, and returned — and the very next tick, sixteen milliseconds
   * later, started accumulating over-tilt again. A device held past the limit
   * therefore spilled every 320ms without pause. Measured: 187 spills a
   * minute, each one an `onFail`, each one a dent in the level's score and a
   * row in the event log the server rescores from. That log is capped at 400
   * events, so a long enough storm does not just cost points, it silently
   * truncates the rest of the run.
   *
   * With the pause the tray behaves as documented and the player gets the
   * beat they need to notice the readout and level off.
   */
  const refill = useRef(0);
  /* Latched, so a changed tilt or a re-created callback never restarts the
     physics mid-slide. See `useLatest` for why this is not a plain ref write. */
  const tiltRef = useLatest(tilt);
  const cbs = useLatest({ onDone, onSpill });

  /*
   * The tray lives in a ref and React is told about it for rendering.
   *
   * Deciding "that was the last digit" inside a state updater looked tidier
   * and was wrong: several ticks can queue inside one React batch, and every
   * one of them then runs against the same stale "already finished" flag and
   * calls onSolve again. The timer owns the physics; state is a copy for the
   * screen.
   */
  const live = useRef(freshTray(digits.length));

  useEffect(() => {
    const id = setInterval(() => {
      if (done.current) return;

      /* Refilling. No physics, and — the part that matters — no spill
         detection either, so a tilt that is still too steep cannot spill a
         tray that has not finished being refilled. */
      if (refill.current > 0) {
        refill.current -= STEP_MS;
        if (refill.current <= 0) {
          overTilt.current = 0;
          live.current = { ...live.current, spilling: false };
          setTray(live.current);
        }
        return;
      }

      const now = tiltRef.current;

      /* Spilling needs to be sustained. A momentary jolt while you reach for
         the phone is not the player being careless, and punishing it would
         make the level feel like it was lying about its own rules. */
      overTilt.current = Math.abs(now) > SPILL_DEG ? overTilt.current + STEP_MS : 0;
      if (overTilt.current >= SPILL_GRACE_MS) {
        overTilt.current = 0;
        refill.current = REFILL_MS;
        live.current = {
          x: live.current.x.map((at, i) => (live.current.seated[i] ? null : at === null ? null : 0)),
          seated: live.current.seated,
          spilling: true,
        };
        setTray(live.current);
        cbs.current.onSpill();
        return;
      }

      live.current = step(live.current, now, STEP_MS);
      setTray(live.current);

      if (live.current.seated.every(Boolean)) {
        done.current = true;
        cbs.current.onDone();
      }
    }, STEP_MS);

    return () => clearInterval(id);
  }, [cbs, tiltRef]);

  return tray;
}
