"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameClock, formatClock } from "@/engine/clock";
import { comboFor, RUN_DURATION_MS, SKIP_PENALTY_MS } from "@/engine/scoring";
import { capabilityMarks } from "@/engine/deck";
import { encodeSeed, streamFor } from "@/engine/rng";
import { createSfx, type SfxHandle } from "@/engine/sfx";
import { currentLevel, useRun } from "@/engine/store";
import type { DealtLevel, InputCapability, LevelResult } from "@/engine/types";
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
export function RunClient({ seed, mercy }: { seed: number; mercy: boolean }) {
  const capabilities = useMemo(() => detectPassive(), []);
  const sfx = useMemo(() => createSfx(), []);

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

  const [remaining, setLocalRemaining] = useState(RUN_DURATION_MS);
  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState(0);
  const clock = useRef<GameClock | null>(null);

  useEffect(() => {
    startRun({ seed, registry: REGISTRY, capabilities, mercy });
  }, [startRun, seed, capabilities, mercy]);

  /* One clock for the whole run. Started on mount, never paused — not for
     permission prompts, not for popups. */
  useEffect(() => {
    const c = new GameClock({ durationMs: RUN_DURATION_MS });
    clock.current = c;
    const offTick = c.onTick((ms) => {
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
  }, [sfx, setRemaining]);

  const current = deck[index] ?? null;
  const combo = comboFor(streak);

  if (phase === "tally") {
    return (
      <Tally
        score={score}
        breakdown={breakdown}
        killedBy={killedBy}
        elapsed={RUN_DURATION_MS - remaining}
        seedText={encodeSeed(seed, capabilityMarks(capabilities))}
      />
    );
  }

  if (!current) return <div className={s.shell} />;

  return (
    <RunStage
      key={current.module.meta.id}
      current={current}
      seed={seed}
      remaining={remaining}
      score={score}
      combo={combo}
      muted={muted}
      flash={flash}
      capabilities={capabilities}
      sfx={sfx}
      onSolve={() => {
        sfx.solve();
        solve();
      }}
      onFail={(reason) => {
        setFlash((n) => n + 1);
        fail(reason);
      }}
      onSkip={() => {
        sfx.skip();
        clock.current?.penalize(SKIP_PENALTY_MS);
        skip();
      }}
      onToggleMute={() => {
        const next = !muted;
        setMuted(next);
        sfx.setMuted(next);
      }}
    />
  );
}

function RunStage(props: {
  current: DealtLevel;
  seed: number;
  remaining: number;
  score: number;
  combo: number;
  muted: boolean;
  flash: number;
  capabilities: ReadonlySet<InputCapability>;
  sfx: SfxHandle;
  onSolve: () => void;
  onFail: (reason?: string) => void;
  onSkip: () => void;
  onToggleMute: () => void;
}) {
  const { current, seed, remaining, score, combo, muted, flash, capabilities, sfx } = props;
  const input = useInput(current.module.meta.requires, capabilities);
  const rng = useMemo(() => streamFor(seed, current.module.meta.id), [seed, current]);

  const Body =
    current.degraded && current.module.Fallback ? current.module.Fallback : current.module.Component;

  return (
    <div className={s.shell}>
      <div className={s.hud}>
        <div className={s.mark}>
          AI&nbsp;<i>RUSH</i>
        </div>
        {combo > 1 && <div className={s.combo}>×{combo}</div>}
        <div className={s.spacer} />
        <div className={s.stat}>
          SCORE <b>{score.toLocaleString()}</b>
        </div>
        <div className={`${s.clock} ${remaining <= 30_000 ? s.low : ""}`} data-testid="clock">
          {formatClock(remaining)}
        </div>
        <button className={s.iconBtn} onClick={props.onToggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <div className={s.stage}>
        {current.modifiers.length > 0 && (
          <div className={s.mods}>
            {current.modifiers.map((m) => (
              <span key={m}>{MODIFIERS[m].label}</span>
            ))}
          </div>
        )}

        <div className={flash > 0 ? s.shake : undefined} key={flash} data-level={current.module.meta.id}>
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
          <span className={s.skipNote}>−10s · combo → ×1</span>
        </div>
      </div>

      <div key={`flash-${flash}`} className={`${s.flash} ${flash > 0 ? s.flashOn : ""}`} />
    </div>
  );
}

function Tally({
  score, breakdown, killedBy, elapsed, seedText,
}: {
  score: number;
  breakdown: LevelResult[];
  killedBy: string | null;
  elapsed: number;
  seedText: string;
}) {
  const [shown, setShown] = useState(0);

  /* Overshoot into absurdity, then snap back to the truth. */
  useEffect(() => {
    const t0 = performance.now();
    const DUR = 1700;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / DUR);
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

  const solved = breakdown.filter((b) => !b.skipped).length;
  const skipped = breakdown.filter((b) => b.skipped).length;
  const best = breakdown.reduce((m, b) => Math.max(m, b.combo), 1);

  return (
    <div className={s.shell}>
      <div className={s.stage} style={{ justifyContent: "center", gap: "0.9rem" }}>
        <div className={s.stamp}>{killedBy ? "TIME" : "DECK CLEARED"}</div>
        <div className={s.tallyScore} data-testid="final-score">
          {shown.toLocaleString()}
        </div>

        <div className={s.rows}>
          {breakdown.map((b, i) => (
            <div key={`${b.id}-${i}`} className={s.row}>
              <span>
                {b.id} · {b.title}
              </span>
              <span>{b.skipped ? "skipped" : `${b.points.toLocaleString()} ×${b.combo}`}</span>
            </div>
          ))}
          <div className={s.row}><span>Levels solved</span><span>{solved} / {breakdown.length}</span></div>
          <div className={s.row}><span>Skipped</span><span>{skipped}</span></div>
          <div className={s.row}><span>Best combo</span><span>×{best}</span></div>
          <div className={s.row}><span>Elapsed</span><span>{formatClock(elapsed)}</span></div>
          <div className={s.row}><span>Seed</span><span>{seedText}</span></div>
          {killedBy && (
            <div className={`${s.row} ${s.death}`}>
              <span>Cause of death</span>
              <span>&ldquo;{killedBy}&rdquo;</span>
            </div>
          )}
        </div>

        <button className={s.again} onClick={() => window.location.reload()}>
          Run it again
        </button>
      </div>
    </div>
  );
}

export { currentLevel };
