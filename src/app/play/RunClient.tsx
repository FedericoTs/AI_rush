"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameClock, formatClock } from "@/engine/clock";
import { comboFor, RUN_DURATION_MS, SKIP_PENALTY_MS } from "@/engine/scoring";
import { capabilityMarks, PRACTICE_DURATION_MS } from "@/engine/deck";
import { encodeSeed, streamFor } from "@/engine/rng";
import { createSfx, type SfxHandle } from "@/engine/sfx";
import { currentLevel, useRun } from "@/engine/store";
import type { DealtLevel, InputCapability } from "@/engine/types";
import { Endgame, type Challenge } from "./Endgame";
import { PracticeEnd } from "./PracticeEnd";
import { Handle } from "@/ui/Handle";
import { MODIFIERS } from "@/engine/chaos/modifiers";
import { detectPassive } from "@/input/capabilities";
import { useInput } from "@/input/useInput";
import { REGISTRY } from "@/levels/registry";
import s from "./play.module.css";

/**
 * The run.
 *
 * The only place that knows about both run state and level content. Levels
 * receive callbacks and stay pure — the ESLint sandbox on src/levels/**
 * enforces that they cannot reach back in here.
 *
 * Time has exactly one owner: the GameClock. The store reads it and never
 * moves it, which is why a skip's ten seconds are charged here rather than
 * inside the reducer.
 */
export function RunClient({
  seed,
  mercy,
  challenge = null,
  practice = null,
}: {
  seed: number;
  mercy: boolean;
  challenge?: Challenge | null;
  /**
   * Level ids to play instead of a dealt deck. Practice never opens a run
   * server-side and never posts anything: a leaderboard you can farm one level
   * at a time is not a leaderboard.
   */
  practice?: readonly string[] | null;
}) {
  const capabilities = useMemo(() => detectPassive(), []);
  const sfx = useMemo(() => createSfx(), []);
  const durationMs = practice ? PRACTICE_DURATION_MS : RUN_DURATION_MS;

  const startRun = useRun((r) => r.startRun);
  const setRemaining = useRun((r) => r.setRemaining);
  const phase = useRun((r) => r.phase);
  const deck = useRun((r) => r.deck);
  const index = useRun((r) => r.index);
  const score = useRun((r) => r.score);
  const streak = useRun((r) => r.streak);
  const breakdown = useRun((r) => r.breakdown);
  const killedBy = useRun((r) => r.killedBy);
  const solve = useRun((r) => r.solve);
  const fail = useRun((r) => r.fail);
  const skip = useRun((r) => r.skip);

  const [remaining, setLocalRemaining] = useState(durationMs);
  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState(0);
  const [run, setRun] = useState<{ id: string; secret: string } | null>(null);
  const clock = useRef<GameClock | null>(null);
  const events = useRun((r) => r.events);
  const elapsedMs = useRun((r) => r.elapsedMs);

  /* The selection arrives as a fresh array on every render of the route, and a
     run must not restart because an array changed identity. The list is short
     and its contents are the whole meaning of it, so the joined string is the
     honest dependency. */
  const practiceKey = practice ? practice.join(",") : null;
  const only = useMemo(() => (practiceKey === null ? undefined : practiceKey.split(",")), [practiceKey]);

  useEffect(() => {
    startRun({ seed, registry: REGISTRY, capabilities, mercy, only, durationMs });
  }, [startRun, seed, capabilities, mercy, only, durationMs]);

  /* Open the run server-side in the background. If this fails — no database,
     offline, rate limited — the game is unaffected and the score is simply
     never posted. A leaderboard is not allowed to stand between a player and
     five minutes of interfaces. */
  useEffect(() => {
    if (only) return; // practice is never filed
    let cancelled = false;
    void fetch("/api/run/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed: encodeSeed(seed, capabilityMarks(capabilities)),
        caps: capabilityMarks(capabilities).join(""),
        mercy,
      }),
    })
      .then((r) => r.json())
      .then((r: { runId?: string; runSecret?: string }) => {
        if (!cancelled && r.runId && r.runSecret) setRun({ id: r.runId, secret: r.runSecret });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seed, capabilities, mercy, only]);

  /* One clock for the whole run. Started on mount, never paused — not for
     permission prompts, not for popups. */
  useEffect(() => {
    const c = new GameClock({ durationMs });
    clock.current = c;
    /* The clock ticks every frame; the HUD shows m:ss. Re-rendering the whole
       run sixty times a second to redraw the same string is pure waste, and it
       is what made a canvas level unplayable. Only the second boundary is a
       state change worth having. */
    let lastSecond = -1;
    const offTick = c.onTick((ms) => {
      const second = Math.ceil(ms / 1000);
      if (second === lastSecond) return;
      lastSecond = second;
      setLocalRemaining(ms);
      setRemaining(ms);
    });
    c.start();
    sfx.unlock();
    return () => {
      offTick();
      c.stop();
      clock.current = null;
    };
  }, [sfx, setRemaining, durationMs]);

  /*
   * Stable identities, deliberately.
   *
   * A level receives these as props, and a canvas level keeps its game loop in
   * an effect keyed on them. Recreating them each render tears that loop down
   * and rebuilds it — which, combined with a clock that used to re-render this
   * component every frame, reset the runner sixty times a second.
   */
  const handleSolve = useCallback(() => {
    sfx.solve();
    solve();
  }, [sfx, solve]);

  const handleFail = useCallback(
    (reason?: string) => {
      setFlash((n) => n + 1);
      fail(reason);
    },
    [fail],
  );

  /* The ten seconds are a cost against a five-minute budget. Practice has no
     budget worth defending, so charging them there would be noise. */
  const handleSkip = useCallback(() => {
    sfx.skip();
    if (!only) clock.current?.penalize(SKIP_PENALTY_MS);
    skip();
  }, [sfx, skip, only]);

  const handleToggleMute = useCallback(() => {
    setMuted((m) => {
      sfx.setMuted(!m);
      return !m;
    });
  }, [sfx]);

  const current = deck[index] ?? null;
  const combo = comboFor(streak);

  if (phase === "tally" && only) {
    return (
      <div className={s.shell}>
        <PracticeEnd
          breakdown={breakdown}
          elapsed={Math.round(Math.max(elapsedMs, durationMs - remaining))}
          ids={only}
        />
      </div>
    );
  }

  if (phase === "tally") {
    return (
      <div className={s.shell}>
        <Endgame
          score={score}
          breakdown={breakdown}
          killedBy={killedBy}
          elapsed={Math.round(Math.max(elapsedMs, RUN_DURATION_MS - remaining))}
          seedText={encodeSeed(seed, capabilityMarks(capabilities))}
          mercy={mercy}
          events={events}
          runId={run?.id ?? null}
          runSecret={run?.secret ?? null}
          challenge={challenge}
        />
      </div>
    );
  }

  if (!current) return <div className={s.shell} />;

  return (
    <RunStage
      key={current.module.meta.id}
      current={current}
      seed={seed}
      remaining={remaining}
      elapsed={durationMs - remaining}
      score={score}
      combo={combo}
      muted={muted}
      flash={flash}
      capabilities={capabilities}
      sfx={sfx}
      challenge={challenge}
      practice={only !== undefined}
      position={only ? `${index + 1}/${deck.length}` : null}
      onSolve={handleSolve}
      onFail={handleFail}
      onSkip={handleSkip}
      onToggleMute={handleToggleMute}
    />
  );
}

function RunStage(props: {
  current: DealtLevel;
  seed: number;
  remaining: number;
  elapsed: number;
  score: number;
  combo: number;
  muted: boolean;
  flash: number;
  capabilities: ReadonlySet<InputCapability>;
  sfx: SfxHandle;
  challenge: Challenge | null;
  practice: boolean;
  /** "3/14" while practising, so the room says where you are in it. */
  position: string | null;
  onSolve: () => void;
  onFail: (reason?: string) => void;
  onSkip: () => void;
  onToggleMute: () => void;
}) {
  const {
    current, seed, remaining, elapsed, score, combo, muted, flash, capabilities, sfx, challenge,
    practice, position,
  } = props;
  const input = useInput(current.module.meta.requires, capabilities);
  const rng = useMemo(() => streamFor(seed, current.module.meta.id), [seed, current]);

  /* Shake by adding a class and letting the animation itself take it away
     again, rather than by remounting the level underneath it. Driven by the
     animation's own end event, so there is no timer to drift and no state set
     from an effect. */
  const [settled, setSettled] = useState(0);
  const shaking = flash > settled;

  const Body =
    current.degraded && current.module.Fallback ? current.module.Fallback : current.module.Component;

  return (
    <div className={s.shell}>
      {/*
        * Practice counts up, a run counts down.
        *
        * The countdown is the pressure, and the pressure is exactly what a
        * training room is for removing. What is left is the only number
        * practice can honestly offer: how long this is taking you.
        */}
      <div className={s.hud}>
        <div className={s.mark}>
          AI&nbsp;<i>RUSH</i>
        </div>
        {practice ? (
          <span className={s.practiceTag} data-testid="practice-tag">
            PRACTICE {position}
          </span>
        ) : (
          combo > 1 && <div className={s.combo}>×{combo}</div>
        )}
        <div className={s.spacer} />
        {!practice && (
          <div className={s.stat}>
            SCORE <b>{score.toLocaleString()}</b>
          </div>
        )}
        <div
          className={`${s.clock} ${!practice && remaining <= 30_000 ? s.low : ""}`}
          data-testid="clock"
        >
          {formatClock(practice ? elapsed : remaining)}
        </div>
        {practice && (
          <Link className={s.iconBtn} href="/levels" aria-label="Back to the level index">
            ✕
          </Link>
        )}
        <button className={s.iconBtn} onClick={props.onToggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {challenge && <GhostBar challenge={challenge} score={score} />}

      <div className={s.stage}>
        {current.modifiers.length > 0 && (
          <div className={s.mods}>
            {current.modifiers.map((m) => (
              <span key={m}>{MODIFIERS[m].label}</span>
            ))}
          </div>
        )}

        {/*
          * No key here, deliberately.
          *
          * Keying this on the fail counter re-triggered the shake animation by
          * remounting the level — which threw away everything the level had
          * just done. L37 re-seeded its dials a second time, L02's "Invalid
          * code" message was wiped before anyone could read it, and L11's game
          * loop restarted on every death. Failing is supposed to reset a level
          * on the level's own terms, not destroy it.
          */}
        <div
          className={shaking ? s.shake : undefined}
          onAnimationEnd={() => setSettled(flash)}
          data-level={current.module.meta.id}
        >
          <Body
            onSolve={props.onSolve}
            onFail={props.onFail}
            rng={rng}
            chaos={current.modifiers}
            degraded={current.degraded}
            input={input}
            sfx={sfx}
          />
        </div>

        <div className={s.skipRow}>
          <button className={s.skip} onClick={props.onSkip}>
            SKIP THIS LEVEL
          </button>
          <span className={s.skipNote}>{practice ? "free in here" : "−10s · combo → ×1"}</span>
        </div>
      </div>

      <div key={`flash-${flash}`} className={`${s.flash} ${flash > 0 ? s.flashOn : ""}`} />
    </div>
  );
}

/**
 * Who you are chasing, and by how much.
 *
 * Deliberately just a number on a bar rather than a live opponent: there is no
 * lobby, nobody has to be online, and the link works forever. Passing them
 * mid-run is the moment worth building for.
 */
function GhostBar({ challenge, score }: { challenge: Challenge; score: number }) {
  const gap = score - challenge.score;
  const ahead = gap >= 0;
  const progress = Math.min(100, (score / Math.max(1, challenge.score)) * 100);

  return (
    <>
      <div className={s.ghost}>
        <span className={s.ghostLabel}>Chasing</span>
        <Handle handle={challenge.handle} size={20} link={false} />
        <span className={s.ghostSp} />
        <span className={`${s.ghostGap} ${ahead ? s.ahead : s.behind}`}>
          {ahead ? `+${gap.toLocaleString()} ahead` : `${Math.abs(gap).toLocaleString()} to go`}
        </span>
      </div>
      <div className={s.ghostTrack}>
        <div className={s.ghostFill} style={{ width: `${progress}%` }} />
      </div>
    </>
  );
}

export { currentLevel };
