"use client";

import { useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const MIN = 6;

/**
 * Typing into Password mirrors into Confirm, one character behind. They can
 * never match, and the validation message is always, infuriatingly, correct.
 *
 * Two solves, both real. Finish the password and add the missing character to
 * Confirm by hand — which feels like getting away with something. Or type into
 * Confirm first: the mirror stops the moment that field has been touched, and
 * nothing anywhere checks whether it should start again.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sub] = useState(() => slopSubhead(rng));
  const confirmTouched = useRef(false);

  const matches = password.length >= MIN && password === confirm;

  const onPassword = (v: string) => {
    setPassword(v);
    /* One character behind, and only while Confirm is still untouched. */
    if (!confirmTouched.current) setConfirm(v.slice(0, -1));
  };

  const onConfirm = (v: string) => {
    confirmTouched.current = true;
    setConfirm(v);
  };

  const submit = () => {
    if (!matches) return;
    sfx.pick(1);
    onSolve();
  };

  return (
    <SlopCard>
      <SlopBadge>Account · Bank-Level Security</SlopBadge>
      <SlopHeading>Confirm Your Password 🔐</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.field}>
        <label htmlFor="l42-pw">Password</label>
        <input
          id="l42-pw"
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
        />
      </div>

      <div className={s.field}>
        <label htmlFor="l42-confirm">Confirm Password</label>
        <input
          id="l42-confirm"
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>

      <div className={`${s.match} ${matches ? s.yes : s.no}`}>
        {matches
          ? "Passwords match. ✨"
          : password.length < MIN
            ? `Password must be at least ${MIN} characters.`
            : "Passwords do not match."}
      </div>

      <SlopCta onClick={submit} disabled={!matches}>
        Create Account
      </SlopCta>
      <SlopHint>
        For your convenience we keep the confirmation field in sync as you type. 🪄
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L42: LevelModule = { meta, Component };
