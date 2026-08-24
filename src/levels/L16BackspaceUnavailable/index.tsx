"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const TARGET = "Ada Lovelace";

/**
 * Backspace inserts. Delete does nothing. There is no clear button.
 *
 * Both escapes are real browser behaviours the "broken" field simply forgot to
 * break: select a stretch and type over it, or select it and drag it out of
 * the field entirely. Selection is untouched precisely because a developer
 * hurried enough to get backspace this wrong would never have thought about it.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [value, setValue] = useState("");
  const [lastChar, setLastChar] = useState("");
  const [sub] = useState(() => slopSubhead(rng));

  const matches = value === TARGET;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      /* It does not remove the last character. It adds it again. */
      if (lastChar) {
        setValue((v) => v + lastChar);
        sfx.click();
      }
      return;
    }
    if (e.key === "Delete") e.preventDefault();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (next.length > value.length) setLastChar(next.slice(-1));
    setValue(next);
  };

  const submit = () => {
    if (matches) {
      onSolve();
      return;
    }
    onFail("mismatch");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Profile · AI-Powered</SlopBadge>
      <SlopHeading>Type Your Full Name ⌨️</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.target}>{TARGET}</div>

      <input
        className={`${s.field} ${value.length > TARGET.length ? s.overflow : ""}`}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="off"
        aria-label="Your full name"
        placeholder="Type it exactly"
      />

      <div className={s.state}>
        <span>{value.length} / {TARGET.length}</span>
        <span className={matches ? s.good : undefined}>
          {matches ? "exact match ✓" : "does not match"}
        </span>
      </div>

      <SlopCta onClick={submit} disabled={!matches}>
        Save Profile
      </SlopCta>
      <SlopHint>
        Please enter your name exactly as shown. Corrections can be made using standard text
        editing. ✏️
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L16: LevelModule = { meta, Component };
