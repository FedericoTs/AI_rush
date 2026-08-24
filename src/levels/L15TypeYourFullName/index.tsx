"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const TARGET = "Beatrix Wolstenholme";
/** How long a pause it takes for the corrector to pounce. */
const IDLE_MS = 300;

const CORRECTIONS: Record<string, string> = {
  Beatrix: "Beatrice",
  Wolstenholme: "Wholesomeness",
  Wolsten: "Wholesome",
  Beat: "Beast",
  Bea: "Bear",
  Wol: "Wool",
};

/**
 * What the corrector does to the last word, and only the last word.
 *
 * Exported because it is the whole mechanic and deserves testing as a function
 * rather than through a keyboard.
 */
export function correct(text: string): string {
  const words = text.split(" ");
  const last = words[words.length - 1] ?? "";
  if (!last) return text;

  const exact = CORRECTIONS[last];
  if (exact) {
    words[words.length - 1] = exact;
    return words.join(" ");
  }
  /* Nothing exact? Then the longest known prefix, "helpfully" completed. */
  for (const [from, to] of Object.entries(CORRECTIONS)) {
    if (from.startsWith(last) && last.length >= 3) {
      words[words.length - 1] = to;
      return words.join(" ");
    }
  }
  return text;
}

/**
 * An autocomplete that will not leave you alone.
 *
 * Three hundred milliseconds after you stop typing, the current word is
 * replaced with a wrong one. Fast typing simply outruns it.
 *
 * There is a better route than speed, and it is the one worth finding: the
 * corrector only ever touches the **last** word, so typing a decoy word after
 * your real one shields it — then delete the decoy in one motion and submit
 * before the timer comes round again.
 *
 * No hard fail. The field just fights you, and the clock does the rest.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  const [text, setText] = useState("");
  const [corrections, setCorrections] = useState(0);
  const [sub] = useState(() => slopSubhead(rng));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Armed on every change, cleared on unmount. The effect never sets state
     directly — it only schedules — so nothing here fights React's batching. */
  useEffect(() => {
    if (!text) return;
    timer.current = setTimeout(() => {
      setText((cur) => {
        const fixed = correct(cur);
        if (fixed !== cur) {
          setCorrections((n) => n + 1);
          sfx.blip();
        }
        return fixed;
      });
    }, IDLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, sfx]);

  const done = text.trim() === TARGET;

  return (
    <SlopCard>
      <SlopBadge>Account · AI-Powered</SlopBadge>
      <SlopHeading>Type Your Full Name ✍️</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.target}>{TARGET}</div>

      <input
        className={s.field}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Full name"
        aria-label="Full name"
        autoComplete="off"
        spellCheck={false}
        data-testid="name-field"
      />

      <div className={s.state}>
        <span className={done ? s.good : undefined}>
          {done ? "matches" : `${text.length}/${TARGET.length}`}
        </span>
        <span>autocorrect: {corrections} fixes applied</span>
      </div>

      <SlopCta onClick={() => done && onSolve()} disabled={!done}>
        {done ? "Continue" : "Name does not match our records"}
      </SlopCta>
      <SlopHint>
        Smart Compose™ corrects unusual spellings as you type, so you don&apos;t have to. ✨
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L15: LevelModule = { meta, Component };
