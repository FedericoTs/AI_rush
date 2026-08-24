"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/engine/clock";
import type { LevelResult } from "@/engine/types";
import type { RunEvent } from "@/engine/scoring";
import { causeOfDeath, shareText, verdict, xIntent } from "@/lib/share";
import { Handle } from "@/ui/Handle";
import s from "./endgame.module.css";

interface BoardRow {
  rank: number;
  handle: string;
  score: number;
  levels_solved: number;
  killed_by: string | null;
}

type Stage = "tally" | "claim" | "board";

/** Someone whose exact run you are playing, and the number to beat. */
export interface Challenge {
  handle: string;
  score: number;
}

export interface EndgameProps {
  score: number;
  breakdown: LevelResult[];
  killedBy: string | null;
  elapsed: number;
  seedText: string;
  mercy: boolean;
  events: RunEvent[];
  runId: string | null;
  runSecret: string | null;
  challenge?: Challenge | null;
}

/**
 * The thirty seconds after the five minutes.
 *
 * Tally, then claim, then the board. Each stage waits for the player rather
 * than a timer — the one thing worse than a slow endgame is one that moves on
 * before you have read your own score.
 */
export function Endgame(props: EndgameProps) {
  const {
    score, breakdown, killedBy, elapsed, seedText, mercy, events, runId, runSecret,
    challenge = null,
  } = props;
  const [stage, setStage] = useState<Stage>("tally");
  const [shown, setShown] = useState(0);
  const [handle, setHandle] = useState("@");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const submitted = useRef(false);
  /* The run has to land before it can be ranked. A player who skips straight
     through can reach the claim box before the submit round-trip returns, so
     claiming waits on this rather than racing it. */
  const landing = useRef<Promise<void> | null>(null);

  const solved = breakdown.filter((b) => !b.skipped).length;
  const offline = !runId || !runSecret;

  /* Submit the log as soon as the run ends, while the player reads the tally.
     The score that reaches the board is the one the server recomputes. */
  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    if (offline) return;
    landing.current = fetch("/api/run/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        runSecret,
        events,
        durationMs: elapsed,
        killedBy,
      }),
    })
      .then((r) => r.json())
      .then((r: { rank?: number }) => {
        if (typeof r.rank === "number") setRank(r.rank);
      })
      .catch(() => {});
  }, [offline, runId, runSecret, elapsed, killedBy, events]);

  /* Overshoot into absurdity, then snap back to the truth. */
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1700);
      const over = score * 1.6 + 99_000;
      setShown(
        p < 0.62
          ? Math.floor((p / 0.62) * over)
          : Math.floor(over + (score - over) * (1 - Math.pow(1 - (p - 0.62) / 0.38, 3))),
      );
      if (p < 1) raf = requestAnimationFrame(step);
      else setShown(score);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  async function loadBoard(mine: string | null) {
    try {
      const res = await fetch(`/api/board?around=${score}&mercy=${mercy ? 1 : 0}`);
      const data = (await res.json()) as { rows?: BoardRow[] };
      setRows(data.rows ?? []);
    } catch {
      setRows([]);
    }
    setMyHandle(mine);
    setStage("board");
  }

  async function claim() {
    const clean = handle.replace(/^@+/, "").trim();
    if (!/^[A-Za-z0-9_]{1,15}$/.test(clean)) {
      setClaimError("That is not a valid X handle. Letters, numbers and underscores, up to 15.");
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      await landing.current;
      const res = await fetch("/api/run/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, runSecret, handle: clean }),
      });
      const data = (await res.json()) as { ok?: boolean; rank?: number; reason?: string };
      if (!data.ok) {
        setClaimError(
          data.reason === "bad_handle"
            ? "That is not a valid X handle."
            : "Could not claim that place. Your score still stands — try again?",
        );
        setClaiming(false);
        return;
      }
      if (typeof data.rank === "number") setRank(data.rank);
      await loadBoard(`@${clean}`);
    } catch {
      setClaimError("Could not reach the leaderboard. Your score still counts locally.");
    }
    setClaiming(false);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = origin ? `${origin}/play?seed=${seedText}` : "";
  /* The challenge link carries the seed plus your name and number, so whoever
     opens it plays your exact run with your score to chase. No lobby, nobody
     has to be online, and it keeps working a year from now. */
  const challengeUrl =
    myHandle && origin
      ? `${origin}/play?seed=${seedText}&vs=${encodeURIComponent(myHandle.replace(/^@+/, ""))}&target=${score}`
      : url;
  const post = shareText({
    score,
    solved,
    total: breakdown.length,
    killedBy: causeOfDeath(breakdown, killedBy),
    rank,
    url: challengeUrl,
    pick: score,
    rival: challenge,
  });

  return (
    <div className={s.wrap}>
      {challenge && (
        <div className={`${s.versus} ${score > challenge.score ? s.won : s.lost}`}>
          <Handle handle={challenge.handle} size={30} link={false} />
          <div className={s.versusText}>
            {score > challenge.score ? (
              <>
                <b>You beat them by {(score - challenge.score).toLocaleString()}.</b>
                <span>They scored {challenge.score.toLocaleString()} on this exact run.</span>
              </>
            ) : (
              <>
                <b>They still lead by {(challenge.score - score).toLocaleString()}.</b>
                <span>Same seed, same levels, same order. No excuses available.</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className={s.stamp}>{killedBy ? "TIME" : "DECK CLEARED"}</div>
      <div className={s.score} data-testid="final-score">{shown.toLocaleString()}</div>
      <div className={s.verdict}>{verdict(solved, breakdown.length)}</div>

      {stage === "tally" && (
        <>
          <div className={s.rows}>
            {breakdown.map((b, i) => (
              <div key={`${b.id}-${i}`} className={s.row}>
                <span>{b.id} · {b.title}</span>
                <span>{b.skipped ? "skipped" : `${b.points.toLocaleString()} ×${b.combo}`}</span>
              </div>
            ))}
            <div className={s.row}><span>Levels solved</span><span>{solved} / {breakdown.length}</span></div>
            <div className={s.row}><span>Elapsed</span><span>{formatClock(elapsed)}</span></div>
            <div className={s.row}><span>Seed</span><span>{seedText}</span></div>
            {killedBy && (
              <div className={`${s.row} ${s.death}`}>
                <span>Cause of death</span><span>&ldquo;{killedBy}&rdquo;</span>
              </div>
            )}
          </div>
          <button className={s.primary} onClick={() => setStage(offline ? "board" : "claim")}>
            {offline ? "See the board" : "Claim your place"}
          </button>
        </>
      )}

      {stage === "claim" && (
        <div className={s.claim}>
          <h3>Claim your place</h3>
          <p>Your handle will appear publicly on the leaderboard.</p>
          <div className={s.handleRow}>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.startsWith("@") ? e.target.value : `@${e.target.value}`)}
              onKeyDown={(e) => e.key === "Enter" && void claim()}
              maxLength={16}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Your X handle"
            />
            <button onClick={() => void claim()} disabled={claiming}>
              {claiming ? "…" : "Post it"}
            </button>
          </div>
          {claimError && <div className={s.claimErr}>{claimError}</div>}
          <button className={s.anon} onClick={() => void loadBoard(null)}>
            Skip — don&rsquo;t put me on the board
          </button>
        </div>
      )}

      {stage === "board" && (
        <>
          {rank !== null && <div className={s.bStamp}>#{rank.toLocaleString()}</div>}

          {rows.length > 0 ? (
            <div className={s.board}>
              {rows.map((r, i) => {
                const mine = myHandle !== null && r.handle === myHandle;
                return (
                  <div key={`${r.handle}-${i}`} className={`${s.bRow} ${mine ? s.bMine : s.shoved}`}>
                    <span className={s.bRank}>#{r.rank.toLocaleString()}</span>
                    <span className={s.bHandle}>
                      <Handle handle={r.handle} size={24} link={!mine} />
                    </span>
                    <span className={s.bScore}>{r.score.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={s.offline}>
              {offline
                ? "No leaderboard on this build — your score is local only."
                : "You are the first person here. That is either an honour or a warning."}
            </div>
          )}

          <div className={s.actions}>
            <a className={s.primary} href={xIntent(post)} target="_blank" rel="noreferrer">
              Post to X
            </a>
            <a className={s.secondary} href="/board">
              See the whole board
            </a>
            <button
              className={s.secondary}
              onClick={() => {
                void navigator.clipboard?.writeText(challengeUrl);
                setCopied(true);
              }}
            >
              {copied ? "Copied — now go and taunt them" : "Challenge a friend to this exact run"}
            </button>
            <a className={s.secondary} href="/play">
              Run it again
            </a>
            {/* The ask lands here because this is peak motivation: thirty
                seconds after an interface has just humiliated someone. */}
            <a className={s.lab} href="/lab">
              You think you can do worse? Design a level →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
