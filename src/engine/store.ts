"use client";

/**
 * Run state.
 *
 * Levels never import this. They receive onSolve/onFail as props and stay pure
 * functions of those props — enforced by the ESLint sandbox on src/levels/**.
 * The play route is the only thing that wires the two together.
 */

import { create } from "zustand";
import type { CapabilitySet } from "@/input/capabilities";
import { dealDeck } from "./deck";
import type { DealtLevel, LevelModule, LevelResult } from "./types";
import { comboFor, scoreLevel, RUN_DURATION_MS } from "./scoring";
import type { RunEvent } from "./scoring";

export type Phase = "title" | "calibrating" | "playing" | "tally";

export interface RunState {
  phase: Phase;
  seed: number;
  mercy: boolean;
  deck: DealtLevel[];
  index: number;

  score: number;
  streak: number;
  solved: number;
  skipped: number;
  bestCombo: number;

  /** Fails on the current level. Reset on entry; costs the first-try bonus only. */
  fails: number;
  levelStartMs: number;
  elapsedMs: number;
  remainingMs: number;

  breakdown: LevelResult[];
  /** Append-only. What the server rescores from (BACKEND.md §4). */
  events: RunEvent[];
  killedBy: string | null;

  startRun(opts: { seed: number; registry: readonly LevelModule[]; capabilities: CapabilitySet; mercy?: boolean }): void;
  enterLevel(): void;
  solve(): void;
  fail(reason?: string): void;
  skip(): void;
  setRemaining(ms: number): void;
  finish(timedOut: boolean): void;
  reset(): void;
}

const BLANK = {
  phase: "title" as Phase,
  seed: 0,
  mercy: false,
  deck: [] as DealtLevel[],
  index: 0,
  score: 0,
  streak: 0,
  solved: 0,
  skipped: 0,
  bestCombo: 1,
  fails: 0,
  levelStartMs: 0,
  elapsedMs: 0,
  remainingMs: RUN_DURATION_MS,
  breakdown: [] as LevelResult[],
  events: [] as RunEvent[],
  killedBy: null as string | null,
};

export const useRun = create<RunState>((set, get) => ({
  ...BLANK,

  startRun({ seed, registry, capabilities, mercy = false }) {
    const deck = dealDeck({ seed, registry, capabilities, mercy });
    set({ ...BLANK, phase: "playing", seed, mercy, deck });
    get().enterLevel();
  },

  enterLevel() {
    const s = get();
    const current = s.deck[s.index];
    if (!current) return s.finish(false);
    if (s.phase !== "playing") return;
    set({
      fails: 0,
      levelStartMs: s.elapsedMs,
      killedBy: current.module.meta.title,
      events: [
        ...s.events,
        { seq: s.events.length + 1, kind: "enter", levelId: current.module.meta.id, atMs: s.elapsedMs },
      ],
    });
  },

  solve() {
    const s = get();
    const current = s.deck[s.index];
    if (!current) return;

    const solveMs = Math.max(0, s.elapsedMs - s.levelStartMs);
    const streak = s.streak + 1;
    const combo = comboFor(streak);
    const points = scoreLevel({
      tier: current.module.meta.tier,
      parSeconds: current.module.meta.parSeconds,
      solveMs,
      fails: s.fails,
      combo,
    }).total;

    set({
      score: s.score + points,
      streak,
      solved: s.solved + 1,
      bestCombo: Math.max(s.bestCombo, combo),
      index: s.index + 1,
      breakdown: [
        ...s.breakdown,
        { id: current.module.meta.id, title: current.module.meta.title, points, solveMs, fails: s.fails, combo, skipped: false },
      ],
      events: [
        ...s.events,
        { seq: s.events.length + 1, kind: "solve", levelId: current.module.meta.id, atMs: s.elapsedMs, solveMs },
      ],
    });
    get().enterLevel();
  },

  fail(_reason) {
    const s = get();
    const current = s.deck[s.index];
    if (!current) return;
    set({
      fails: s.fails + 1,
      events: [
        ...s.events,
        { seq: s.events.length + 1, kind: "fail", levelId: current.module.meta.id, atMs: s.elapsedMs },
      ],
    });
  },

  /**
   * Ten seconds and your streak. Always available, never confirmed — an
   * "are you sure?" here would be the cruelty of a worse game.
   *
   * The ten seconds are charged to the GameClock by the caller, not here:
   * one owner for time, or the two drift apart and solveMs starts lying.
   */
  skip() {
    const s = get();
    const current = s.deck[s.index];
    if (!current) return;
    set({
      streak: 0,
      skipped: s.skipped + 1,
      index: s.index + 1,
      breakdown: [
        ...s.breakdown,
        { id: current.module.meta.id, title: current.module.meta.title, points: 0, solveMs: 0, fails: s.fails, combo: 1, skipped: true },
      ],
      events: [
        ...s.events,
        { seq: s.events.length + 1, kind: "skip", levelId: current.module.meta.id, atMs: s.elapsedMs },
      ],
    });
    get().enterLevel();
  },

  setRemaining(ms) {
    set({ remainingMs: ms, elapsedMs: RUN_DURATION_MS - ms });
    if (ms <= 0 && get().phase === "playing") get().finish(true);
  },

  finish(timedOut) {
    set({ phase: "tally", killedBy: timedOut ? get().killedBy : null });
  },

  reset() {
    set({ ...BLANK });
  },
}));

export function currentLevel(s: RunState): DealtLevel | null {
  return s.deck[s.index] ?? null;
}
