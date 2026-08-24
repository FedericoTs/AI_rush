"use client";

import { useEffect, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import { SETTLE_DEG, SPILL_DEG, slotX, useTray } from "./tray";
import s from "./styles.module.css";

/**
 * Tilt your device to pour four digits into four slots.
 *
 * A spirit level with a lip. Small tilts move a digit along the track; going
 * past thirty-four degrees for a third of a second tips the loose ones back
 * out. Levelling off is what seats a digit — you have to stop, which is the
 * opposite of what hands want to do.
 *
 * The fallback is an on-screen phone you tilt with the mouse, and it is the
 * same level: identical physics, identical par, one number of difference
 * between them. It is also, on a laptop, funnier than the real thing — which
 * is exactly why the level ships with a fallback instead of being swapped out
 * of the deck on devices without a gyroscope.
 */
function Stage({
  tilt,
  onSolve,
  onFail,
  rng,
  sfx,
  children,
  note,
}: {
  tilt: number;
  onSolve: () => void;
  onFail: (reason?: string) => void;
  rng: LevelProps["rng"];
  sfx: LevelProps["sfx"];
  children?: React.ReactNode;
  note: string;
}) {
  const [digits] = useState(() =>
    Array.from({ length: 4 }, () => String(rng.int(10))),
  );
  const [spills, setSpills] = useState(0);
  const [sub] = useState(() => slopSubhead(rng));

  const tray = useTray(
    digits,
    tilt,
    () => {
      sfx.solve();
      onSolve();
    },
    () => {
      setSpills((n) => n + 1);
      sfx.fail();
      onFail("spilled");
    },
  );

  const level = Math.abs(tilt) < SETTLE_DEG;
  const danger = Math.abs(tilt) > SPILL_DEG;

  return (
    <SlopCard>
      <SlopBadge>Verification · Enterprise-Grade</SlopBadge>
      <SlopHeading>Confirm with a gesture 📱</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <p className={s.ask}>Tilt to pour the digits into their slots. Level off to drop one in.</p>

      <div className={`${s.tray} ${danger ? s.danger : ""}`} data-testid="l13-tray">
        {/* The slots. Fixed, evenly spaced, and the thing you are aiming at. */}
        {digits.map((d, i) => (
          <span
            key={`slot-${i}`}
            className={`${s.slot} ${tray.seated[i] ? s.slotFull : ""}`}
            style={{ left: `${slotX(i, digits.length)}%` }}
            data-slot={i}
            data-seated={tray.seated[i] ? "yes" : "no"}
          >
            {tray.seated[i] ? d : ""}
          </span>
        ))}

        {/* And the digits still rolling around in it. */}
        {digits.map((d, i) =>
          tray.x[i] === null ? null : (
            <span
              key={`digit-${i}`}
              className={s.digit}
              style={{ left: `${tray.x[i]}%` }}
              data-digit={i}
            >
              {d}
            </span>
          ),
        )}

        <span className={`${s.bubble} ${level ? s.bubbleLevel : ""}`} aria-hidden="true" />
      </div>

      <div className={s.readout} data-testid="l13-tilt">
        {tilt >= 0 ? "+" : ""}
        {tilt.toFixed(0)}°{level ? " · level" : danger ? " · spilling" : ""}
      </div>

      {children}

      <SlopError>
        {spills > 0 ? `The digits went everywhere. Tray refilled. (${spills}) 🫠` : null}
      </SlopError>
      <p className={s.note}>{note}</p>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

/** The gyroscope path. */
function Component(props: LevelProps) {
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    const motion = props.input.motion;
    if (!motion) return;
    return motion.subscribe((m) => setTilt(m.gamma));
  }, [props.input.motion]);

  return (
    <Stage
      tilt={tilt}
      onSolve={props.onSolve}
      onFail={props.onFail}
      rng={props.rng}
      sfx={props.sfx}
      note="Hold your device flat. Small movements. There is a lip — use it."
    />
  );
}

/**
 * No gyroscope, or permission declined.
 *
 * The device becomes a picture of a device, and you tilt it with the pointer.
 * Same physics, same par, same level. The keyboard drives it too, because a
 * level whose only input is dragging is a level some people cannot play.
 */
function Fallback(props: LevelProps) {
  const [tilt, setTilt] = useState(0);

  return (
    <Stage
      tilt={tilt}
      onSolve={props.onSolve}
      onFail={props.onFail}
      rng={props.rng}
      sfx={props.sfx}
      note="Your device has no motion sensor, so here is one. Drag it, or use the arrow keys."
    >
      <div className={s.phoneWrap}>
        <div className={s.phone} style={{ transform: `rotate(${tilt}deg)` }} aria-hidden="true">
          <span className={s.phoneScreen} />
        </div>
        <input
          className={s.dial}
          type="range"
          min={-60}
          max={60}
          step={1}
          value={tilt}
          aria-label="Tilt the device"
          onChange={(e) => setTilt(Number(e.target.value))}
        />
      </div>
    </Stage>
  );
}

export const L13: LevelModule = { meta, Component, Fallback };
