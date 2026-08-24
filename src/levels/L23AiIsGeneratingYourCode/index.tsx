"use client";

import { useEffect, useState } from "react";
import type { Rng } from "@/engine/rng";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading } from "@/ui/slop/Slop";
import { FOOTER_LINKS } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const STREAM_MS = 28;

interface Draft {
  /** The three codes the assistant confidently produces, in order. */
  codes: [string, string, string];
  /** Which of them is real — the one the citation footer also carries. */
  truth: 0 | 1 | 2;
  text: string;
}

const APOLOGIES = [
  "You're absolutely right — I apologize for the confusion!",
  "Good catch! Let me correct that for you.",
  "My mistake. Thanks for your patience!",
];

function makeDraft(rng: Rng): Draft {
  const code = () => String(rng.range(100_000, 999_999));
  const codes: [string, string, string] = [code(), code(), code()];
  const truth = rng.int(3) as 0 | 1 | 2;

  return {
    codes,
    truth,
    text:
      `Of course! I've generated a secure verification code for you.\n\n` +
      `Your code is ${codes[0]}. Please enter it within the next 10 minutes.\n\n` +
      `Wait — I should double-check that. Looking at your account, the correct ` +
      `code is actually ${codes[1]}.\n\n` +
      `Apologies, one correction: the code associated with this session is ` +
      `${codes[2]}. Let me know if there's anything else I can help with! ✨`,
  };
}

/**
 * The bubble, typing.
 *
 * Its own component so that a new draft *mounts* rather than resetting state
 * from inside an effect — remounting on a key is what React offers instead of
 * "clear this when that changes", and it means the stream can never be caught
 * halfway between two answers.
 */
function Stream({ text }: { text: string }) {
  const [chars, setChars] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setChars((n) => {
        if (n >= text.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, STREAM_MS);
    return () => window.clearInterval(id);
  }, [text]);

  const streaming = chars < text.length;

  return (
    <>
      <div className={s.who}>
        <span className={s.avatar} aria-hidden="true">
          ✦
        </span>
        Assistant
        {streaming && <span className={s.typing}>generating…</span>}
      </div>
      <div className={s.bubble} data-testid="l23-stream">
        {text.slice(0, chars)}
        {streaming && <span className={s.caret} aria-hidden="true" />}
      </div>
    </>
  );
}

/**
 * A chat bubble streams your verification code, then hallucinates twice.
 *
 * Three codes, delivered with identical confidence, each correcting the last.
 * **Regenerate** re-rolls all three, which feels like the way out and is the
 * trap: every regeneration is three fresh wrong-looking answers and eight more
 * seconds off the clock.
 *
 * The answer is already on screen. Under the bubble, in the grey nine-pixel
 * "Sources" line that every assistant renders and nobody has ever read, one of
 * the three codes is cited. That one is real.
 *
 * This is the payoff for L10 — the second time the game pays a player for
 * reading the slop instead of fighting it, and by this point in a run that is
 * a habit rather than a discovery.
 *
 * Getting it wrong makes the assistant apologise beautifully and produce three
 * more, which is both the funniest failure state in the game and an entirely
 * straight description of the thing it is imitating.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [round, setRound] = useState(0);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* Held in state and re-rolled explicitly rather than memoised on a counter
     it never reads. Regenerating is an action, so it looks like one. */
  const [draft, setDraft] = useState<Draft>(() => makeDraft(rng));
  const answer = draft.codes[draft.truth];

  const reroll = () => {
    setDraft(makeDraft(rng));
    setRound((n) => n + 1);
  };

  const submit = () => {
    if (entry.trim() === answer) {
      sfx.solve();
      onSolve();
      return;
    }
    sfx.fail();
    onFail("hallucinated");
    setError(APOLOGIES[round % APOLOGIES.length]!);
    setEntry("");
    reroll();
  };

  return (
    <SlopCard>
      <SlopBadge>Assistant · AI-Powered</SlopBadge>
      <SlopHeading>Verifying your identity 🤖</SlopHeading>

      <div className={s.thread}>
        <Stream text={draft.text} key={round} />

        {/*
          * The citation footer.
          *
          * Nine-pixel grey, below the fold of attention, present from the very
          * first frame and never mentioned anywhere. One of the three codes
          * appears both here and in the body; that one is the answer.
          */}
        <div className={s.sources} data-testid="l23-sources">
          Sources: account.session[{answer}] · policy/verification.md · 2 more
        </div>
      </div>

      <label className={s.label} htmlFor="l23-code">
        Verification code
      </label>
      <div className={s.row}>
        <input
          id="l23-code"
          className={s.input}
          inputMode="numeric"
          maxLength={6}
          value={entry}
          autoComplete="off"
          onChange={(e) => setEntry(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button type="button" className={s.go} onClick={submit}>
          Verify
        </button>
      </div>

      {/* The way out that is not the way out. */}
      <button
        type="button"
        className={s.regen}
        onClick={() => {
          sfx.thud();
          setError(null);
          reroll();
        }}
      >
        ↻ Regenerate response
      </button>

      <SlopError>{error}</SlopError>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L23: LevelModule = { meta, Component };
