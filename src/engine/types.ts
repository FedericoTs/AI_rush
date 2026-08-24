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
  /**
   * The ordinary interface this one is wearing — the same question the Lab
   * form asks submitters. It is the only thing the level index shows about a
   * level, on purpose: what it pretends to be is not a spoiler, and what it
   * actually does is.
   */
  parodies: string;
  tier: Tier;
  family: Family;
  parSeconds: number;
  /** Hard requirements. If unavailable, `Fallback` is rendered instead. */
  requires: InputCapability[];
  /** Modifiers whose core mechanic this level already is. */
  incompatibleModifiers: ModifierId[];
  /** Community-designed levels carry their author forever. */
  creator?: { handle: string; submissionId: string };
  /**
   * Locked content. Absent means the level is in the deck from the first run.
   *
   * `share` levels open when N distinct people have played a run that started
   * from your link. `secret` levels are not earned at all — they are found.
   *
   * A locked level is worth exactly what its tier is worth and nothing more.
   * That is deliberate and load-bearing: it is what stops sharing from being
   * pay-to-win, and it is why nobody has any reason to forge their way past
   * this field.
   */
  unlock?: { kind: "share"; credits: number } | { kind: "secret" };
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
