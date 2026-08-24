"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameClock, formatClock } from "@/engine/clock";
import { comboFor, RUN_DURATION_MS, SKIP_PENALTY_MS } from "@/engine/scoring";
import { capabilityMarks, PRACTICE_DURATION_MS } from "@/engine/deck";
import { NOTHING_UNLOCKED, isUnlocked, type UnlockState } from "@/engine/unlocks";
import { ALL_LEVEL_IDS, META_BY_ID } from "@/levels/catalog";
import { useUnlocks } from "@/lib/unlockStore";
import { encodeSeed, streamFor } from "@/engine/rng";
import { createSfx, type SfxHandle } from "@/engine/sfx";
import { currentLevel, useRun } from "@/engine/store";
import type { DealtLevel, InputCapability } from "@/engine/types";
import { Endgame, type Challenge } from "./Endgame";
import { PracticeEnd } from "./PracticeEnd";
import { Handle } from "@/ui/Handle";
import { Logo } from "@/ui/logo/Logo";
import { MODIFIERS } from "@/engine/chaos/modifiers";
import { SECRET_FOUND } from "@/ui/slop/Slop";
import { detectPassive } from "@/input/capabilities";
import { Calibrate } from "./Calibrate";
import { useInput } from "@/input/useInput";
import { REGISTRY } from "@/levels/registry";
import { ObserverBar, ObserverExport } from "./Observer";
import { FakeNotice } from "./FakeNotice";
import { useWakeLock } from "@/ui/useWakeLock";
import {
  downloadSession, sessionFilename,
  type Mark, type MarkKind, type PlaytestSession,
} from "@/lib/playtest";
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
  unlocks: linkUnlocks = NOTHING_UNLOCKED,
  ref = null,
  observe = false,
}: {
  seed: number;
  mercy: boolean;
  challenge?: Challenge | null;
  /**
   * Attach the playtest observer bar (`docs/PLAYTEST.md`). Nothing about the
   * run changes — the clock does not pause, no marks reach the event log, and
   * the session file is downloaded rather than uploaded.
   */
  observe?: boolean;
  /**
   * What the link says this deck may contain. A bare /play uses whatever this
   * browser has opened; a challenge link uses the sharer's, so their run
   * reproduces exactly — including the levels the visitor has not opened yet.
   */
  unlocks?: UnlockState;
  /** Whoever's link brought this player here, credited only on a real run. */
  ref?: string | null;
  /**
   * Level ids to play instead of a dealt deck. Practice never opens a run
   * server-side and never posts anything: a leaderboard you can farm one level
   * at a time is not a leaderboard.
   */
  practice?: readonly string[] | null;
}) {
  /*
   * Null until calibration answers.
   *
   * `detectPassive()` never returns motion, microphone or camera — a browser
   * hands none of those over outside a user gesture — so without this the six
   * sensor levels could only ever render their fallbacks. Practice skips the
   * screen: a training room should open when you click it.
   */
  const [capabilities, setCapabilities] = useState<ReadonlySet<InputCapability> | null>(
    () => (practice ? detectPassive() : null),
  );
  const sfx = useMemo(() => createSfx(), []);
  const mine = useUnlocks();

  /*
   * A link's unlock state wins over this browser's.
   *
   * That is what makes "same seed, same levels, same order" survive the whole
   * feature — otherwise two people opening one challenge link would be dealt
   * different decks and the head-to-head at the end would be a lie.
   */
  const fromLink = linkUnlocks.credits > 0 || linkUnlocks.secret;
  const unlocks = useMemo<UnlockState>(
    () => (fromLink ? linkUnlocks : { credits: mine.credits, secret: mine.secret }),
    [fromLink, linkUnlocks, mine.credits, mine.secret],
  );
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
  const [foundSecret, setFoundSecret] = useState(false);
  const [run, setRun] = useState<{ id: string; secret: string } | null>(null);
  const clock = useRef<GameClock | null>(null);
  const events = useRun((r) => r.events);
  const elapsedMs = useRun((r) => r.elapsedMs);

  /* Held for exactly as long as the clock is running. Several levels have long
     stretches with no touch — watching a progress bar, standing up, talking at
     the microphone — and a phone that locks after thirty idle seconds turns
     those into a lost run. */
  useWakeLock(phase === "playing");

  /* The observer's marks. Kept here rather than in the store because they are
     not part of the run: the server never sees them, they do not affect the
     score, and a run that happened to be watched must score identically to one
     that was not. */
  const [marks, setMarks] = useState<Mark[]>([]);
  const [subject, setSubject] = useState("");
  const [saved, setSaved] = useState(false);

  /* The selection arrives as a fresh array on every render of the route, and a
     run must not restart because an array changed identity. The list is short
     and its contents are the whole meaning of it, so the joined string is the
     honest dependency. */
  const practiceKey = practice ? practice.join(",") : null;
  const only = useMemo(() => {
    if (practiceKey === null) return undefined;
    const ids = practiceKey.split(",");
    /* `/levels/all` means "all of mine". A hand-written list still plays
       exactly what it names — typing a locked id into the address bar is the
       same category as editing `?u=`, and this game is not going to punish
       someone for reading a URL. */
    if (ids.length !== ALL_LEVEL_IDS.length) return ids;
    return ids.filter((id) => {
      const m = META_BY_ID.get(id);
      return m ? isUnlocked(m, { credits: mine.credits, secret: mine.secret }) : false;
    });
  }, [practiceKey, mine.credits, mine.secret]);

  /* Same reasoning as `only`: a fresh object each render must not restart a
     run, so the deal depends on the values rather than the identity. */
  const unlockSig = `${unlocks.credits}:${unlocks.secret ? 1 : 0}`;

  useEffect(() => {
    if (!capabilities) return;
    const [credits, secret] = unlockSig.split(":");
    startRun({
      seed, registry: REGISTRY, capabilities, mercy, only, durationMs,
      unlocks: { credits: Number(credits), secret: secret === "1" },
    });
  }, [startRun, seed, capabilities, mercy, only, durationMs, unlockSig]);

  /* The one secret in the game, announced the one time it is found. Fired by
     the duplicate "Careers" in the slop footer, which every level carries. */
  useEffect(() => {
    const onFound = () => setFoundSecret(true);
    window.addEventListener(SECRET_FOUND, onFound);
    return () => window.removeEventListener(SECRET_FOUND, onFound);
  }, []);

  /* Open the run server-side in the background. If this fails — no database,
     offline, rate limited — the game is unaffected and the score is simply
     never posted. A leaderboard is not allowed to stand between a player and
     five minutes of interfaces. */
  useEffect(() => {
    if (only || !capabilities) return; // practice is never filed
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
    if (!capabilities) return;
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
  }, [sfx, setRemaining, durationMs, capabilities]);

  /*
   * Stable identities, deliberately.
   *
   * A level receives these as props, and a canvas level keeps its game loop in
   * an effect keyed on them. Recreating them each render tears that loop down
   * and rebuilds it — which, combined with a clock that used to re-render this
   * component every frame, reset the runner sixty times a second.
   */
  /*
   * Put the true time into the store before recording anything.
   *
   * The HUD only re-renders on second boundaries — that was the fix that made
   * a canvas level playable — but the store reads its elapsed time from those
   * same ticks, so every event was being stamped with a time rounded down to
   * the last whole second. Two levels cleared inside one second produced a
   * solve of exactly 0ms, and a 0ms solve was, until this was fixed on both
   * ends, enough to have an entire run thrown out as impossible.
   *
   * The clock stays the single owner of time. This just asks it what time it
   * is at the moment that matters, instead of using the last thing it said.
   */
  const stamp = useCallback(() => {
    const now = clock.current?.remainingMs;
    if (now !== undefined) setRemaining(now);
  }, [setRemaining]);

  const handleSolve = useCallback(() => {
    sfx.solve();
    stamp();
    solve();
  }, [sfx, solve, stamp]);

  const handleFail = useCallback(
    (reason?: string) => {
      setFlash((n) => n + 1);
      stamp();
      fail(reason);
    },
    [fail, stamp],
  );

  /* The ten seconds are a cost against a five-minute budget. Practice has no
     budget worth defending, so charging them there would be noise.

     Charged after the event is recorded, so the skip is stamped with the time
     it actually happened rather than ten seconds into the future. */
  const handleSkip = useCallback(() => {
    sfx.skip();
    stamp();
    skip();
    if (!only) clock.current?.penalize(SKIP_PENALTY_MS);
  }, [sfx, skip, only, stamp]);

  const handleToggleMute = useCallback(() => {
    setMuted((m) => {
      sfx.setMuted(!m);
      return !m;
    });
  }, [sfx]);

  /*
   * A mark, timed against the clock rather than against the HUD.
   *
   * The HUD deliberately only re-renders on second boundaries, so a laugh
   * tagged from `remaining` could land most of a second away from the solve it
   * belongs to — and "did they laugh before or after they got it" is precisely
   * the distinction the whole exercise is trying to record.
   */
  const observedId = deck[index]?.module.meta.id ?? "—";
  const mark = useCallback(
    (kind: MarkKind) => {
      const rem = clock.current?.remainingMs;
      const atMs = rem === undefined ? Math.round(elapsedMs) : Math.round(durationMs - rem);
      setMarks((prev) => [...prev, { atMs, kind, levelId: observedId }]);
    },
    [durationMs, elapsedMs, observedId],
  );

  /* The deck travels with the session, so a report read in three months does
     not need this commit checked out to know what L24's par was at the time. */
  const exportSession = useCallback(() => {
    if (!capabilities) return;
    const session: PlaytestSession = {
      version: 1,
      subject,
      seed: encodeSeed(seed, capabilityMarks(capabilities)),
      mercy,
      durationMs,
      score,
      killedBy,
      levels: deck.map((d) => ({
        id: d.module.meta.id,
        title: d.module.meta.title,
        tier: d.module.meta.tier,
        parSeconds: d.module.meta.parSeconds,
      })),
      marks,
      events,
      breakdown,
    };
    downloadSession(session, sessionFilename(session, new Date()));
    setSaved(true);
  }, [capabilities, subject, seed, mercy, durationMs, score, killedBy, deck, marks, events, breakdown]);

  const observerExport = observe ? (
    <ObserverExport
      subject={subject}
      onSubject={setSubject}
      onExport={exportSession}
      saved={saved}
      marks={marks}
    />
  ) : null;

  if (!capabilities) {
    return (
      <div className={s.shell}>
        <Calibrate mercy={mercy} onDone={setCapabilities} />
      </div>
    );
  }

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
        {observerExport}
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
          unlocks={unlocks}
          ref={ref}
        />
        {observerExport}
      </div>
    );
  }

  if (!current) return <div className={s.shell} />;

  return (
    <>
      {observe && <ObserverBar levelId={current.module.meta.id} marks={marks} onMark={mark} />}
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
        secretFound={foundSecret}
        onSolve={handleSolve}
        onFail={handleFail}
        onSkip={handleSkip}
        onToggleMute={handleToggleMute}
      />
    </>
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
  secretFound: boolean;
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
          <Logo size={13} />
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

        {/* Chrome, never the level. See FakeNotice. */}
        {current.module.meta.collects && (
          <FakeNotice collects={current.module.meta.collects} />
        )}

        {/*
          * A community level carries its author, always.
          *
          * Small, persistent and under the card rather than in the chrome —
          * a byline in the HUD would read as part of the game's own furniture,
          * and the whole value of this line is that it is visibly somebody
          * else's name on somebody else's idea.
          */}
        {current.module.meta.creator && (
          <p className={s.byline}>
            level by {current.module.meta.creator.handle} ·{" "}
            <Link href="/lab">submit yours</Link>
          </p>
        )}

        <div className={s.skipRow}>
          <button className={s.skip} onClick={props.onSkip}>
            SKIP THIS LEVEL
          </button>
          <span className={s.skipNote}>{practice ? "free in here" : "−10s · combo → ×1"}</span>
        </div>
      </div>

      <div key={`flash-${flash}`} className={`${s.flash} ${flash > 0 ? s.flashOn : ""}`} />

      {props.secretFound && (
        <div className={s.secretToast} role="status">
          <b>You read the footer.</b>
          <span>
            There were always two Careers links. <i>Careers</i> is unlocked — it is in the index
            now, and it will turn up in your runs.
          </span>
        </div>
      )}
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
