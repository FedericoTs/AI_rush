"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { META_BY_ID } from "@/levels/catalog";
import { SlopPreview } from "./SlopPreview";
import { band, dealRound, HIGH, LOW, points, PRIOR_WEIGHT, QUESTION, shareText, slopScore } from "./score";
import s from "./slop.module.css";

interface Answer {
  levelId: string;
  guess: number;
  actual: number;
  votes: number;
}

/**
 * Five interfaces, five guesses.
 *
 * The floor for AI Rush is five minutes, and five minutes is a lot to ask of
 * somebody who has just seen a link. Thirty-eight runs became ten finishes
 * became three names on the board. This is the ten-second door: look at one
 * screen, say whether you think somebody really shipped it, find out.
 */
export function SlopClient({ seed }: { seed: number }) {
  const round = useMemo(() => dealRound(seed), [seed]);
  const [at, setAt] = useState(0);
  const [guess, setGuess] = useState(50);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const levelId = round[at];
  const current = answers.length > at ? answers[at]! : null;
  /*
   * Keyed on where the player is, not on how many answers exist.
   *
   * `answers.length === round.length` flips the moment the fifth guess lands,
   * which threw the player straight to the summary and meant the one round
   * they never saw a reveal for was their last one. Every round now ends the
   * same way: lock it in, see how you did, move on.
   */
  const done = at >= round.length;

  const submit = useCallback(async () => {
    if (!levelId || pending) return;
    setPending(true);
    /*
     * The prior is the fallback, not an error state. If the vote cannot be
     * recorded — offline, no database, a rate limit — the round still has a
     * number to score against and the player never sees a failure they can do
     * nothing about.
     */
    let actual = slopScore(levelId, 0, 0);
    let votes = 0;
    try {
      const r = await fetch("/api/slop/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId, score: guess }),
      }).then((x) => x.json() as Promise<{ ok?: boolean; score?: number; votes?: number }>);
      if (r.ok && typeof r.score === "number") {
        actual = r.score;
        votes = r.votes ?? 0;
      }
    } catch {
      /* Keep the prior. */
    }
    setAnswers((a) => [...a, { levelId, guess, actual, votes }]);
    setPending(false);
  }, [levelId, guess, pending]);

  const next = useCallback(() => {
    setAt((n) => n + 1);
    setGuess(50);
  }, []);

  const share = shareText(answers, seed);
  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(share).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [share]);

  if (done) {
    const total = answers.reduce((n, a) => n + points(a.guess, a.actual), 0);
    return (
      <div className={s.shell}>
        <Header />
        <div className={s.grid}>
          {answers.map((a, i) => (
            <span key={i}>{band(a.guess, a.actual) === "bullseye" ? "🟩" : band(a.guess, a.actual) === "close" ? "🟨" : "⬜"}</span>
          ))}
        </div>
        <p className={s.total}>
          <b>{total}</b> / {answers.length * 100}
        </p>

        <ul className={s.tally}>
          {answers.map((a) => (
            <li key={a.levelId} className={s.tallyRow}>
              <span className={s.tallyTitle}>{META_BY_ID.get(a.levelId)?.title ?? a.levelId}</span>
              <span className={s.tallyNums}>
                you {a.guess} · crowd {a.actual}
              </span>
            </li>
          ))}
        </ul>

        <div className={s.row}>
          <button type="button" className={s.cta} onClick={copy}>
            {copied ? "Copied" : "Copy result"}
          </button>
          <Link className={s.ghost} href={`/slop?r=${seed + 1}`}>
            Another five
          </Link>
        </div>
        {/* The point of the whole page: a door into the five-minute game. */}
        <Link className={s.ghost} href="/">
          Now actually play it →
        </Link>
      </div>
    );
  }

  if (!levelId) return <div className={s.shell} />;

  return (
    <div className={s.shell}>
      <Header />
      <div className={s.pips}>
        {round.map((_, i) => (
          <i key={i} className={i < answers.length ? s.done : i === at ? s.on : undefined} />
        ))}
      </div>

      <div className={s.stage}>
        <SlopPreview levelId={levelId} />
      </div>

      {current ? (
        <Reveal answer={current} onNext={next} last={at === round.length - 1} />
      ) : (
        <>
          <p className={s.ask}>{QUESTION}</p>
          <div className={s.readout}>{guess}</div>
          <input
            className={s.slider}
            type="range"
            min={0}
            max={100}
            step={1}
            value={guess}
            aria-label={QUESTION}
            onChange={(e) => setGuess(Number(e.target.value))}
          />
          <div className={s.ends}>
            <span>0 · {LOW}</span>
            <span>{HIGH} · 100</span>
          </div>
          <button type="button" className={s.cta} onClick={() => void submit()} disabled={pending}>
            {pending ? "…" : "Lock it in"}
          </button>
        </>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className={s.head}>
      <h1>
        SLOP <i>SCORE</i>
      </h1>
      <span className={s.sp} />
      <Link className={s.back} href="/">
        AI Rush
      </Link>
    </div>
  );
}

function Reveal({ answer, onNext, last }: { answer: Answer; onNext: () => void; last: boolean }) {
  const off = Math.abs(answer.guess - answer.actual);
  const b = band(answer.guess, answer.actual);
  const title = META_BY_ID.get(answer.levelId)?.title ?? answer.levelId;

  return (
    <div className={s.reveal}>
      <div className={s.bar}>
        <span className={s.crowd} style={{ left: `calc(${answer.actual}% - 1.5px)` }} />
        <span className={s.mine} style={{ left: `calc(${answer.guess}% - 1.5px)` }} />
      </div>
      <div className={s.legend}>
        <span className={s.g}>
          crowd <b>{answer.actual}</b>
        </span>
        <span className={s.h}>
          you <b>{answer.guess}</b>
        </span>
        <span>
          off by <b>{off}</b>
        </span>
      </div>
      <p className={s.verdict}>
        <b>{answer.actual}%</b> think a real product would ship <b>{title}</b>.{" "}
        {b === "bullseye" ? "You read the room." : b === "close" ? "Close enough." : "Not even slightly."}
      </p>
      {/*
        * The vote count, always — and while the crowd is still outweighed by
        * our starting estimate, the fact that it is one. A number resting on
        * four votes is mostly an opinion, and saying so is the difference
        * between a game and a claim.
        */}
      <p className={s.thin}>
        {answer.votes === 0
          ? "no crowd yet — that number is our estimate, and yours is the first vote"
          : answer.votes < PRIOR_WEIGHT
            ? `${answer.votes} vote${answer.votes === 1 ? "" : "s"} so far, still weighted toward our estimate`
            : `${answer.votes} votes before yours`}
      </p>
      <button type="button" className={s.cta} onClick={onNext}>
        {last ? "See your result" : "Next"}
      </button>
    </div>
  );
}
