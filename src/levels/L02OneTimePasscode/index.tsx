"use client";

import { useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const CODE = "481516";
const EMPTY = ["", "", "", "", "", ""];

/**
 * A naive OTP implementation, played completely straight.
 *
 * No auto-advance and no maxlength — exactly the bug a hurried developer
 * ships. Typing the code piles all six digits into whichever cell has focus,
 * visibly overflowing its border. The honest solve is to click each cell and
 * type one digit.
 *
 * The detail worth protecting: a stuffed first cell holds the literally
 * correct string and is still rejected, because the form does not notice.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [cells, setCells] = useState<string[]>(EMPTY);
  const [focus, setFocus] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));
  const catcher = useRef<HTMLInputElement>(null);

  const focusCell = (i: number) => {
    setFocus(i);
    catcher.current?.focus(); // inside the gesture, so iOS raises the keypad
    sfx.click();
  };

  const onInput = (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const digits = el.value.replace(/\D/g, "");
    el.value = "";
    if (!digits) return;
    setCells((prev) => prev.map((c, i) => (i === focus ? c + digits : c)));
    sfx.click();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !e.currentTarget.value) {
      e.preventDefault();
      setCells((prev) => prev.map((c, i) => (i === focus ? c.slice(0, -1) : c)));
    }
  };

  const verify = () => {
    if (cells.every((c) => c.length === 1) && cells.join("") === CODE) {
      onSolve();
      return;
    }
    setError("Invalid code. Please try again! 😊");
    setCells(EMPTY);
    setFocus(0);
    onFail("bad-otp");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Verification · AI-Powered</SlopBadge>
      <SlopHeading>One-Time Passcode 🔒</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.code}>{CODE}</div>

      <div className={s.cells}>
        {cells.map((value, i) => (
          <div
            key={i}
            data-testid={`otp-cell-${i}`}
            className={[s.cell, i === focus ? s.on : "", value.length > 1 ? s.stuffed : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => focusCell(i)}
          >
            <span>{value}</span>
          </div>
        ))}
        <input
          ref={catcher}
          className={s.catcher}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-label="One-time passcode"
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
      </div>

      <SlopCta onClick={verify}>Verify</SlopCta>
      <SlopError>{error}</SlopError>
      <SlopHint>
        Enter the 6-digit code shown above. For your convenience the code has also been sent to
        the device you are currently holding. 📩
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L02: LevelModule = {
  meta,
  Component,
};
