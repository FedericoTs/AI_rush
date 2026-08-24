"use client";

import { useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { SlopCard, SlopHeading, SlopMicrocopy } from "@/ui/slop/Slop";
import s from "./styles.module.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 6;

/**
 * There is no bit.
 *
 * It is a completely normal, functional, well-designed login form. It works.
 * Observed behaviour is that players spend thirty seconds hunting for the
 * trick, tilting the phone, and dragging the logo. Median solve time is
 * expected at four times par.
 *
 * Two things must never change here:
 *
 *   1. It never calls onFail. A validation message produces no flash, no
 *      shake and no lost first-try bonus. Punishment feedback would be a tell.
 *   2. It is built to a *higher* standard than the slop around it. The plain
 *      card, the real focus rings and the honest error copy are what make a
 *      player suspicious, and being suspicious of a good form is the joke.
 */
function Component({ onSolve }: LevelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [note, setNote] = useState<string | null>(null);
  const submitted = useRef(false);

  const submit = () => {
    submitted.current = true;
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "Email address is required.";
    else if (!EMAIL.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    else if (password.length < MIN_PASSWORD)
      next.password = `Password must be at least ${MIN_PASSWORD} characters.`;

    setErrors(next);
    if (!next.email && !next.password) onSolve();
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  return (
    <SlopCard plain>
      <SlopHeading>Sign in</SlopHeading>
      <SlopMicrocopy>Welcome back. Enter your details to continue.</SlopMicrocopy>

      <div className={s.field}>
        <label htmlFor="si-email">Email address</label>
        <input
          id="si-email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onEnter}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "si-email-error" : undefined}
        />
        {errors.email && <div className={s.error} id="si-email-error">{errors.email}</div>}
      </div>

      <div className={s.field}>
        <label htmlFor="si-pw">Password</label>
        <div className={s.pwRow}>
          <input
            id="si-pw"
            type={reveal ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onEnter}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "si-pw-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? "Hide" : "Show"}
          </button>
        </div>
        {errors.password && <div className={s.error} id="si-pw-error">{errors.password}</div>}
      </div>

      <button type="button" className={s.submit} onClick={submit}>
        Sign in
      </button>

      <div className={s.links}>
        <button type="button" onClick={() => setNote("Enter your email address above and we will send you a reset link.")}>
          Forgot password?
        </button>
        <button type="button" onClick={() => setNote("Account creation is not available yet. Signing in works fine.")}>
          Create an account
        </button>
      </div>

      {note && <div className={s.note}>{note}</div>}
    </SlopCard>
  );
}

export const L36: LevelModule = {
  meta: {
    id: "L36",
    slug: "sign-in",
    title: "Sign In",
    tier: "forbidden",
    family: "meta",
    parSeconds: 20,
    requires: ["pointer"],
    /* Nothing may be layered on top of this one. A modifier would be a tell,
       and the level is worth 1000 points precisely because it is untouched. */
    incompatibleModifiers: [
      "drift", "confetti", "rainbow", "shrink", "comic", "slippery",
      "popups", "whisper", "fleeing", "lag", "mirror", "rotate",
    ],
  },
  Component,
};
