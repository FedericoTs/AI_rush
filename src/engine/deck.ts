/**
 * Dealing a run.
 *
 * A deck is dealt once, from the seed, before the clock starts — not drawn
 * level by level. That is what makes a seed link reproduce a run exactly, and
 * it is what lets the constraints in GAME_DESIGN.md §5 be enforced globally
 * instead of hoped for locally.
 *
 * The deal must never fail. A player with every permission denied, on a
 * keyboard-less device, in Mercy Mode, still gets a full, fair five minutes.
 * When constraints cannot all be met the dealer relaxes them in a defined
 * order rather than throwing.
 */

import type { CapabilityMark } from "./rng";
import { streamFor, type Rng } from "./rng";
import type { DealtLevel, InputCapability, LevelModule, ModifierId, Tier } from "./types";
import { NOTHING_UNLOCKED, isUnlocked, type UnlockState } from "./unlocks";
import {
  ALL_MODIFIERS, MAX_CONCURRENT_MODIFIERS, MERCY_SAFE_MODIFIERS, MODIFIERS_START_SEC,
} from "./chaos/modifiers";

/** Tier pools by nominal position in the run, in seconds. */
const WINDOWS: ReadonlyArray<{ untilSec: number; tiers: readonly Tier[] }> = [
  { untilSec: 75, tiers: ["annoying"] },
  { untilSec: 165, tiers: ["annoying", "cursed"] },
  { untilSec: 255, tiers: ["cursed", "unhinged"] },
  { untilSec: Infinity, tiers: ["unhinged", "forbidden"] },
];

/** Deal past the clock so a fast player never runs out of levels. */
export const DECK_SIZE = 14;

/** The Honest Level shows up in one run in eight, and never early. */
export const HONEST_LEVEL_ID = "L36";
const HONEST_LEVEL_CHANCE = 1 / 8;
const HONEST_LEVEL_EARLIEST_SEC = 120;

/** Cognitively expensive; three in one run reads as a puzzle game. */
const MAX_COUPLED_PER_RUN = 2;
/** Permission fatigue is real fatigue, and it isn't funny. */
const MAX_PERMISSION_LEVELS_PER_RUN = 1;
const PERMISSION_CAPS: readonly InputCapability[] = ["audioIn", "camera"];

export type CapabilitySet = ReadonlySet<InputCapability>;

export interface DealOptions {
  seed: number;
  registry: readonly LevelModule[];
  capabilities: CapabilitySet;
  mercy?: boolean;
  /**
   * What this deck is allowed to contain. Carried in the seed link so a
   * challenge reproduces exactly — a run dealt with content you have opened
   * plays the same for whoever follows the link.
   */
  unlocks?: UnlockState;
}

function tiersAt(sec: number): readonly Tier[] {
  for (const w of WINDOWS) if (sec < w.untilSec) return w.tiers;
  return WINDOWS[WINDOWS.length - 1]!.tiers;
}

function needsPermission(mod: LevelModule): boolean {
  return mod.meta.requires.some((r) => PERMISSION_CAPS.includes(r));
}

function missingCaps(mod: LevelModule, caps: CapabilitySet): InputCapability[] {
  return mod.meta.requires.filter((r) => !caps.has(r));
}

interface DealState {
  used: Set<string>;
  lastFamily: string | null;
  coupled: number;
  permission: number;
}

/**
 * Constraints in the order we are willing to give them up. Everything above
 * the line is a hard rule; below it, a run with an awkward adjacency beats a
 * run that is one level short.
 */
const CONSTRAINTS: ReadonlyArray<{
  name: string;
  ok(mod: LevelModule, st: DealState): boolean;
}> = [
  { name: "family-adjacency", ok: (m, st) => m.meta.family !== st.lastFamily },
  { name: "coupled-budget", ok: (m, st) => m.meta.family !== "coupled" || st.coupled < MAX_COUPLED_PER_RUN },
  { name: "permission-budget", ok: (m, st) => !needsPermission(m) || st.permission < MAX_PERMISSION_LEVELS_PER_RUN },
];

export function dealDeck(opts: DealOptions): DealtLevel[] {
  const { seed, registry, capabilities, mercy = false, unlocks = NOTHING_UNLOCKED } = opts;
  const rng = streamFor(seed, "deck");

  /* 1. What can this device and this player actually play? */
  const playable = registry.filter((mod) => {
    if (mod.meta.id === HONEST_LEVEL_ID) return false; // dealt separately
    if (!isUnlocked(mod.meta, unlocks)) return false;
    const missing = missingCaps(mod, capabilities);
    if (missing.length > 0 && !mod.Fallback) return false;
    if (mercy && missing.length === 0 && needsPermission(mod)) return false;
    if (mercy && mod.meta.family === "sensor" && !mod.Fallback) return false;
    return true;
  });

  const honest = registry.find((m) => m.meta.id === HONEST_LEVEL_ID) ?? null;
  const honestSlot =
    honest && rng.chance(HONEST_LEVEL_CHANCE) ? { pending: true } : { pending: false };

  const st: DealState = { used: new Set(), lastFamily: null, coupled: 0, permission: 0 };
  const dealt: DealtLevel[] = [];
  let nominalSec = 0;

  for (let slot = 0; slot < DECK_SIZE; slot++) {
    let chosen: LevelModule | null = null;

    if (honestSlot.pending && honest && nominalSec >= HONEST_LEVEL_EARLIEST_SEC) {
      chosen = honest;
      honestSlot.pending = false;
    } else {
      chosen = pick(playable, tiersAt(nominalSec), st, rng);
    }
    if (!chosen) break;

    const missing = missingCaps(chosen, capabilities);
    const degraded = missing.length > 0;

    dealt.push({
      module: chosen,
      degraded,
      modifiers: rollModifiers(chosen, nominalSec, mercy, rng),
    });

    st.used.add(chosen.meta.id);
    st.lastFamily = chosen.meta.family;
    if (chosen.meta.family === "coupled") st.coupled++;
    if (needsPermission(chosen)) st.permission++;
    nominalSec += chosen.meta.parSeconds;
  }

  return dealt;
}

/**
 * Pick from the tier pool, honouring as many constraints as the remaining
 * candidates allow. Drops them one at a time, hardest-to-keep last, and only
 * widens the tier pool once every constraint has already been given up.
 */
function pick(
  playable: readonly LevelModule[],
  tiers: readonly Tier[],
  st: DealState,
  rng: Rng,
): LevelModule | null {
  const unused = playable.filter((m) => !st.used.has(m.meta.id));
  if (unused.length === 0) return null;

  const inTier = unused.filter((m) => tiers.includes(m.meta.tier));

  for (let drop = 0; drop <= CONSTRAINTS.length; drop++) {
    const active = CONSTRAINTS.slice(0, CONSTRAINTS.length - drop);
    const ok = inTier.filter((m) => active.every((c) => c.ok(m, st)));
    if (ok.length > 0) return rng.pick(ok);
  }

  /* Tier pool exhausted. Better an off-tier level than a short run. */
  return rng.pick(unused);
}

function rollModifiers(
  mod: LevelModule,
  nominalSec: number,
  mercy: boolean,
  rng: Rng,
): ModifierId[] {
  if (nominalSec < MODIFIERS_START_SEC) return [];

  const pool = (mercy ? MERCY_SAFE_MODIFIERS : ALL_MODIFIERS).filter(
    (id) => !mod.meta.incompatibleModifiers.includes(id),
  );
  if (pool.length === 0) return [];

  /* Ramps with the run: one modifier around 2:00, two by the end. */
  const progress = Math.min(1, (nominalSec - MODIFIERS_START_SEC) / 180);
  const count = rng.chance(0.35 + progress * 0.45)
    ? rng.chance(progress * 0.6)
      ? MAX_CONCURRENT_MODIFIERS
      : 1
    : 0;

  return rng.shuffle(pool).slice(0, count);
}

/* ── practice ──────────────────────────────────────────────────────── */

/**
 * Practice gets half an hour rather than five minutes.
 *
 * The countdown is the whole tension of a real run and has no business in a
 * room where you are trying to work out how a level works. This is not "no
 * clock" — a run with no end never reaches a tally, and the elapsed time is
 * the only honest thing practice has to tell you — it is a ceiling far enough
 * away that nobody meets it.
 */
export const PRACTICE_DURATION_MS = 30 * 60 * 1000;

export interface PracticeOptions {
  registry: readonly LevelModule[];
  /** Level ids, played in exactly this order. Unknown ids are dropped. */
  ids: readonly string[];
  capabilities: CapabilitySet;
}

/**
 * A deck built by hand instead of dealt.
 *
 * No tier ramp, no seeded picks, no Honest Level roll, and deliberately no
 * chaos modifiers: practice is for learning what a level actually does, and a
 * level under a modifier is a different level. The seed still drives each
 * level's own RNG, so a practice link reproduces exactly as a run link does.
 */
export function practiceDeck(opts: PracticeOptions): DealtLevel[] {
  const byId = new Map(opts.registry.map((m) => [m.meta.id, m]));

  return opts.ids.flatMap((id) => {
    const mod = byId.get(id);
    if (!mod) return [];
    return [{ module: mod, degraded: missingCaps(mod, opts.capabilities).length > 0, modifiers: [] }];
  });
}

export function capabilityMarks(caps: CapabilitySet): CapabilityMark[] {
  const marks: CapabilityMark[] = [];
  if (caps.has("motion")) marks.push("M");
  if (caps.has("audioIn")) marks.push("A");
  if (caps.has("camera")) marks.push("C");
  return marks;
}
