import type { FC } from "react";
import type { Rng } from "./rng";
import type { InputHandle } from "@/input/useInput";
import type { SfxHandle } from "./sfx";

export type Tier = "annoying" | "cursed" | "unhinged" | "forbidden";

/** What a level does to you. Orthogonal to tier, which is what it costs you. */
export type Family = "text" | "pick" | "coupled" | "motor" | "sensor" | "meta";

export type InputCapability =
  | "pointer" | "keyboard" | "touch" | "multitouch"
  | "motion" | "orientation"
  | "audioIn" | "audioOut" | "camera" | "haptics"
  | "clipboard" | "gamepad";

export type ModifierId =
  | "drift" | "confetti" | "rainbow" | "shrink" | "comic" | "slippery"
  | "popups" | "whisper"
  | "fleeing" | "lag" | "mirror" | "rotate";

export interface LevelMeta {
  /** Stable id. Never reused, never renumbered — seeds reference it. */
  id: string;
  slug: string;
  title: string;
  tier: Tier;
  family: Family;
  parSeconds: number;
  /** Hard requirements. If unavailable, `Fallback` is rendered instead. */
  requires: InputCapability[];
  /** Modifiers whose core mechanic this level already is. */
  incompatibleModifiers: ModifierId[];
  /** Community-designed levels carry their author forever. */
  creator?: { handle: string; submissionId: string };
}

export interface LevelProps {
  /** Call once. The engine ignores repeats. */
  onSolve(): void;
  /** Level-internal reset. Costs no clock time — see GAME_DESIGN.md P3. */
  onFail(reason?: string): void;
  /** Deterministic per (runSeed, levelId). Never use Math.random in a level. */
  rng: Rng;
  chaos: readonly ModifierId[];
  /** True when running the degraded path for a missing capability. */
  degraded: boolean;
  input: InputHandle;
  sfx: SfxHandle;
}

export interface LevelModule {
  meta: LevelMeta;
  Component: FC<LevelProps>;
  /** Rendered instead of Component when a required capability is missing. */
  Fallback?: FC<LevelProps>;
}

/** One level as dealt into a run: which module, how, and under what chaos. */
export interface DealtLevel {
  module: LevelModule;
  degraded: boolean;
  modifiers: ModifierId[];
}

export interface LevelResult {
  id: string;
  title: string;
  points: number;
  solveMs: number;
  fails: number;
  combo: number;
  skipped: boolean;
}
