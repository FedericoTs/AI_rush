"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

/**
 * A completely ordinary login form, flipped horizontally.
 *
 * Nothing is broken. The labels are right, the tab order is right, the button
 * does what it says. The entire card is `scaleX(-1)`, so text renders
 * backwards and every mouse movement goes the wrong way — and typing, which
 * needs no aiming at all, works perfectly.
 *
 * There is no trick and no fail state. The whole level is the recovery arc:
 * twenty seconds of flailing, then sudden competence, because people are far
 * more adaptable than they expect to be. Players remember beating this one.
 *
 * Deliberately not a keyboard-only cheat: `Tab` and `Enter` work, as they do
 * everywhere in this game, and using them is a completely legitimate way to
 * beat it. Someone who works out that the keyboard is unmirrored has solved
 * the level as intended — that realisation *is* the level.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const ready = email.includes("@") && password.length >= 4;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) {
      setError("Please enter a valid email and a password of at least 4 characters.");
      sfx.thud();
      return;
    }
    sfx.solve();
    onSolve();
  };

  return (
    <div className={s.flip}>
      <SlopCard>
        <SlopBadge>Account · Zero-Trust</SlopBadge>
        <SlopHeading>Welcome back 👋</SlopHeading>
        <SlopMicrocopy>{sub}</SlopMicrocopy>

        <form onSubmit={submit}>
          <label className={s.label} htmlFor="l31-email">
            Email
          </label>
          <input
            id="l31-email"
            className={s.input}
            type="email"
            value={email}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className={s.label} htmlFor="l31-pw">
            Password
          </label>
          <input
            id="l31-pw"
            className={s.input}
            type="password"
            value={password}
            autoComplete="off"
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" className={s.cta}>
            Sign in
          </button>
        </form>

        <SlopError>{error}</SlopError>
        <SlopHint>
          Having trouble? Try turning your device around. Our layout engine adapts to your
          preferred reading direction automatically. ↔️
        </SlopHint>
        <SlopFooter links={FOOTER_LINKS} />
      </SlopCard>
    </div>
  );
}

export const L31: LevelModule = { meta, Component };
