"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

/**
 * The handshake.
 *
 * Cancel wears the large friendly green of a primary action. Continue wears
 * destructive red and a warning triangle. Every instinct in the player's hands
 * is wrong, and it costs four seconds to learn the whole game's thesis.
 *
 * The fail path is the actual level: clicking Cancel restores the sane
 * arrangement just long enough for the player to commit to it, then swaps back.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [cursed, setCursed] = useState(true);
  const [sub] = useState(() => slopSubhead(rng));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onCancel = () => {
    onFail("clicked-cancel");
    sfx.fail();
    setCursed(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCursed(true);
      sfx.click();
    }, 400);
  };

  return (
    <SlopCard>
      <SlopBadge>Step 1 of 2 · Bank-Level Security</SlopBadge>
      <SlopHeading>Continue To Your Account ✨</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.row}>
        <button type="button" className={cursed ? s.good : s.ghost} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={cursed ? s.bad : s.good} onClick={onSolve}>
          {cursed ? "⚠ Continue" : "Continue"}
        </button>
      </div>

      <SlopHint>
        By continuing you agree to our Terms, our other Terms, and the processing of your data
        by 1,400 carefully selected partners. 🔐
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L01: LevelModule = {
  meta,
  Component,
};
