"use client";

import { useLayoutEffect, useRef, useState } from "react";
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

/** The escape, hidden in the body copy a little under halfway down. */
const ESCAPE_AT = 9;
const GROW_AT = 0.8;
const GROW_BY = 1.2;
/*
 * Where growing stops and the rubber band takes over.
 *
 * Twenty percent compounding is exponential in the number of times a player
 * flicks, and players flick a lot: fifteen seconds of honest scrolling crosses
 * eighty percent twenty-seven times, which is twenty-six paragraphs becoming
 * three thousand eight hundred. That is not a joke about terms of service, it
 * is a phone browser dying.
 *
 * `LEVELS.md` already describes the way out and it had never been built —
 * "it also has rubber-band overscroll that throws you back up". Past the cap
 * the document stops growing and starts throwing, which costs the player
 * exactly what another twenty percent would have and costs the browser
 * nothing. The end stays unreachable either way, which is the only property
 * the level actually needs.
 */
const MAX_CLAUSES = 220;
const SNAP_BACK_TO = 0.45;

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
  /*
   * One growth per pass of eighty percent — which is what the level claims to
   * do, and what it did not.
   *
   * `scroll` fires many times per gesture and React batches the state it
   * produces, so every event in a batch measured the same un-grown document,
   * saw the same eighty percent, and called the same functional update. They
   * compounded. Measured: a single flick of the wheel grew the document six
   * times, and fifteen seconds of honest scrolling turned twenty-six
   * paragraphs into three thousand eight hundred — enough to make a phone
   * unusable, and enough to shove the solve far above the reader before they
   * could read it.
   *
   * The latch is cleared below, after the browser has actually laid the
   * bigger document out. Until then no amount of scrolling can grow it again,
   * which is the whole point: the document grows when the player travels, not
   * when the event loop is busy.
   */
  const armed = useRef(true);

  const measure = (box: HTMLDivElement) => {
    const max = box.scrollHeight - box.clientHeight;
    return max > 0 ? box.scrollTop / max : 0;
  };

  /*
   * Re-measure once the longer document exists, and re-arm.
   *
   * This is also what keeps the accept button out of reach. `pct` is state,
   * set from whatever the document was at the moment of the scroll — so after
   * a growth it still read the pre-growth number, and a player who slammed to
   * the bottom four times rendered "100%" over a document that was nowhere
   * near its end, with the button enabled and wired to a fail. The comment on
   * that button said it was reachable only if the document stopped growing.
   * It was reachable in about four seconds.
   *
   * Layout effect rather than effect: this runs before the browser paints, so
   * the enabled button never appears for even one frame.
   */
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box) setPct(measure(box));
    armed.current = true;
  }, [count]);

  const onScroll = () => {
    const box = boxRef.current;
    if (!box) return;
    const p = measure(box);
    setPct(p);

    if (p >= GROW_AT && armed.current) {
      armed.current = false;
      setGrows((n) => n + 1);
      sfx.blip();

      if (count < MAX_CLAUSES) {
        setCount((n) => Math.ceil(n * GROW_BY));
      } else {
        /* Nothing new to render, so nothing re-arms the latch — do it here.
           The throw itself fires another scroll event, which measures the
           document honestly and puts the bar back where the player now is. */
        box.scrollTop = box.scrollHeight * SNAP_BACK_TO;
        armed.current = true;
      }
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
          {count < MAX_CLAUSES
            ? `Additional terms loaded (${grows}). Please continue reading. 📄`
            : `Additional terms loaded (${grows}). Restoring your place. 📄`}
        </div>
      )}

      <button
        type="button"
        className={s.cta}
        disabled={!atBottom}
        onClick={() => {
          /* Unreachable: every scroll that arrives at the end grows the
             document past it, and the percentage is re-measured against the
             longer one before paint. Left wired to a fail rather than deleted
             so the button is honest about being a button, and so that any
             future path to it is a loss rather than a silent win. */
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
