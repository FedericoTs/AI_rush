"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopHint } from "@/ui/slop/Slop";
import { FOOTER_LINKS } from "@/ui/slop/phrases";
import s from "./styles.module.css";

/** Long enough to be unbearable, short enough that the level is finishable. */
const LAG_MS = 900;

const FIELDS = [
  { id: "name", label: "Full name", hint: "As it appears on your documents" },
  { id: "company", label: "Company", hint: "Optional, but we will ask again" },
  { id: "role", label: "Role", hint: "Choose the closest match" },
  { id: "size", label: "Team size", hint: "Approximate is fine" },
] as const;

type FieldId = (typeof FIELDS)[number]["id"];

/**
 * Nine hundred milliseconds of lag on everything.
 *
 * Keystrokes, focus, the button — all of it arrives just late enough that your
 * hands stop believing the screen. The form itself is trivial: four fields,
 * fill them in, submit.
 *
 * The honest solve is to trust the lag. Type the whole field blind and wait;
 * the characters are queued and every one of them lands. Players who batch
 * their input beat this in under thirty seconds. Players who repeat a keystroke
 * because nothing happened double-enter everything and fight the form for two
 * minutes — which is not a punishment we add, it is simply what impatience
 * does here, and it is the most accurate thing in the game about using
 * software on a bad connection.
 *
 * Nothing is dropped, ever. A level that lost input would be broken rather
 * than slow, and the difference matters: this has to be survivable by waiting.
 */
function Component({ onSolve, onFail, sfx }: LevelProps) {
  const [shown, setShown] = useState<Record<FieldId, string>>({
    name: "", company: "", role: "", size: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );

  /** Everything the player does goes through here, and arrives 900ms later. */
  const delay = (fn: () => void) => {
    setPending((n) => n + 1);
    const t = window.setTimeout(() => {
      setPending((n) => Math.max(0, n - 1));
      fn();
    }, LAG_MS);
    timers.current.push(t);
  };

  const type = (id: FieldId, value: string) => {
    sfx.blip();
    delay(() => setShown((prev) => ({ ...prev, [id]: value })));
  };

  const submit = () => {
    sfx.click();
    delay(() => {
      const missing = FIELDS.filter((f) => shown[f.id].trim().length === 0);
      if (missing.length > 0) {
        setError(`${missing.length} field${missing.length === 1 ? "" : "s"} still empty. Please complete the form.`);
        onFail("incomplete");
        return;
      }
      sfx.solve();
      onSolve();
    });
  };

  return (
    <SlopCard>
      <SlopBadge>Profile · Blazing Fast</SlopBadge>
      <SlopHeading>Tell us about your team 🌐</SlopHeading>

      <div className={s.status} role="status">
        <span className={`${s.dot} ${pending > 0 ? s.busy : ""}`} aria-hidden="true" />
        {pending > 0 ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…` : "All changes saved"}
      </div>

      {FIELDS.map((f) => (
        <div className={s.field} key={f.id}>
          <label className={s.label} htmlFor={`l32-${f.id}`}>
            {f.label}
          </label>
          {/*
            * Uncontrolled on purpose.
            *
            * A controlled input whose value lags by 900ms eats characters — the
            * browser resets the caret on every late render and the field
            * becomes genuinely unusable rather than slow. The DOM keeps what
            * you typed; the *form's* idea of what you typed is what lags, and
            * that is the honest version of a bad connection.
            */}
          <input
            id={`l32-${f.id}`}
            className={s.input}
            defaultValue=""
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => type(f.id, e.target.value)}
          />
          <span className={s.echo} data-field={f.id}>
            {shown[f.id] ? `saved: ${shown[f.id]}` : f.hint}
          </span>
        </div>
      ))}

      <button type="button" className={s.cta} onClick={submit}>
        Continue
      </button>

      <SlopError>{error}</SlopError>
      <SlopHint>
        We&rsquo;re experiencing higher than usual latency in your region. Your data is safe and
        will sync automatically. ⚡
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L32: LevelModule = { meta, Component };
