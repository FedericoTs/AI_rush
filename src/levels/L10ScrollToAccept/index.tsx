"use client";

import { useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopFooter, SlopHeading, SlopHint } from "@/ui/slop/Slop";
import { FOOTER_LINKS } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const CLAUSES = [
  "You grant us a perpetual, irrevocable, worldwide licence to your submissions, your likeness, and any reasonable inference drawn from either.",
  "Service availability is provided on a best-effort basis and best effort is defined solely by us.",
  "We may modify these terms at any time. Continued use constitutes acceptance. Discontinued use also constitutes acceptance.",
  "Data is processed in the region we find most convenient on the day.",
  "Our AI features are provided for informational purposes and should not be relied upon for decisions of any kind, including the decision to use them.",
  "You agree not to reverse engineer, decompile, or think too hard about the service.",
  "Disputes will be resolved by binding arbitration in a jurisdiction to be announced.",
  "We reserve the right to introduce a plan below your plan and move your features into it.",
  "Uptime commitments are aspirational and are measured after the fact by us.",
  "Support response times are measured from the moment we begin responding.",
  "You are responsible for keeping your credentials secure and for our failure to do so.",
  "This agreement is governed by the laws of whichever place gives us the better outcome.",
  "Nothing in this section limits anything in any other section, including this one.",
  "Fees are non-refundable, including fees charged in error, which we will characterise as a discount on future errors.",
  "We may email you. Opting out opts you into a different list.",
];

/** The escape, hidden in the body copy at roughly three-fifths depth. */
const ESCAPE_AT = 9;
const GROW_AT = 0.8;

function paragraph(i: number): string {
  return `${i + 1}. ${CLAUSES[i % CLAUSES.length]!} ${CLAUSES[(i * 7 + 3) % CLAUSES.length]!}`;
}

/**
 * Accept is disabled until you reach the bottom, and the bottom moves.
 *
 * Every time you pass eighty percent the document grows by another fifth, so
 * the progress bar is real, honest, and permanently wrong. There is no amount
 * of scrolling that finishes it — which sounds unfair until you notice that
 * scrolling was never the mechanic.
 *
 * Buried in the body text, in the same grey as everything around it, is a real
 * sentence with a real link: *by continuing to not read this, you agree
 * anyway*. Reading is the solve. Scrolling is the trap.
 *
 * This is the level that teaches players to actually look at the slop copy,
 * and it is placed early on purpose, because that habit is what makes the
 * forbidden tier survivable.
 */
function Component({ onSolve, onFail, sfx }: LevelProps) {
  const [count, setCount] = useState(26);
  const [pct, setPct] = useState(0);
  const [grows, setGrows] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const onScroll = () => {
    const box = boxRef.current;
    if (!box) return;
    const max = box.scrollHeight - box.clientHeight;
    const p = max > 0 ? box.scrollTop / max : 0;
    setPct(p);

    if (p >= GROW_AT) {
      setCount((n) => Math.ceil(n * 1.2));
      setGrows((n) => n + 1);
      sfx.blip();
    }
  };

  const atBottom = pct >= 0.999;

  return (
    <SlopCard>
      <SlopBadge>Legal · SOC2 (pending)</SlopBadge>
      <SlopHeading>Updated Terms of Service 📜</SlopHeading>

      <div className={s.box} ref={boxRef} onScroll={onScroll}>
        <p className={s.preamble}>
          Please review the following before continuing. You must read to the end to accept.
        </p>

        {Array.from({ length: count }, (_, i) =>
          i === ESCAPE_AT ? (
            <p className={s.clause} key={i}>
              {i + 1}. {CLAUSES[i % CLAUSES.length]}{" "}
              {/* Set in exactly the same grey as the paragraph around it, because
                  a link that looks like a link is not hidden, it is a button. */}
              <button type="button" className={s.escape} onClick={() => { sfx.solve(); onSolve(); }}>
                By continuing to not read this, you agree anyway — click here.
              </button>{" "}
              {CLAUSES[(i * 7 + 3) % CLAUSES.length]}
            </p>
          ) : (
            <p className={s.clause} key={i}>
              {paragraph(i)}
            </p>
          ),
        )}
      </div>

      <div className={s.progressRow}>
        <div className={s.track}>
          <div className={s.fill} style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
        <span className={s.pct}>{Math.round(pct * 100)}%</span>
      </div>
      {grows > 0 && (
        <div className={s.grew} role="status">
          Additional terms loaded ({grows}). Please continue reading. 📄
        </div>
      )}

      <button
        type="button"
        className={s.cta}
        disabled={!atBottom}
        onClick={() => {
          /* Reachable only if the document ever stops growing, which it does
             not. Left in and wired to a fail so the button is honest about
             being a button rather than decoration. */
          sfx.fail();
          onFail("scrolled");
        }}
      >
        {atBottom ? "I Have Read And Accept" : "Scroll to the end to accept"}
      </button>

      <SlopHint>
        We&rsquo;ve made these terms clearer and easier to read. Reading time: approximately 4
        minutes. ⏱️
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L10: LevelModule = { meta, Component };
