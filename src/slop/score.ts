import { CATALOG, META_BY_ID } from "@/levels/catalog";
import { mulberry32 } from "@/engine/rng";
import type { Tier } from "@/engine/types";

/** Levels in one round. Short enough to finish on a phone in a queue. */
export const ROUNDS = 5;

/**
 * The question, and why it is this question.
 *
 * "How sloppy is this?" has no spread — every level in the catalogue is
 * maximum slop by construction, they share a design system, and the honest
 * answer for all forty-nine is "very". A game whose answer is always the same
 * number is not a game.
 *
 * What genuinely varies is **plausibility**: L36 is a completely ordinary
 * sign-in form and L11 dispenses your password from a dinosaur. So the score
 * is the share of people who think a real product would actually ship it —
 * which is also the satire landing, because the uncomfortable ones are the
 * levels people believe.
 */
export const QUESTION = "Would a real product actually ship this?";
export const LOW = "We made it up";
export const HIGH = "I have seen this";

/**
 * A prior, so the game works before anybody has voted.
 *
 * With no votes there is no crowd, and the first players would be scored
 * against nothing. The obvious fix — hand-authoring forty-nine numbers — makes
 * the "crowd score" my opinion wearing a crowd's clothes.
 *
 * This is derived instead from a property the catalogue already carries.
 * Tier is how far a level goes, and how far it goes is inversely how likely
 * anyone is to have met it in the wild. It is a starting position, weighted
 * like a handful of votes, and real votes bury it quickly.
 */
const PRIOR_BY_TIER: Record<Tier, number> = {
  annoying: 78,
  cursed: 62,
  unhinged: 45,
  forbidden: 30,
};

/** How many votes the prior is worth. Past this the crowd owns the number. */
export const PRIOR_WEIGHT = 8;

export function priorFor(levelId: string): number {
  const meta = META_BY_ID.get(levelId);
  return meta ? PRIOR_BY_TIER[meta.tier] : 50;
}

/**
 * The published slop score: the prior, buried under whatever the crowd said.
 *
 * `votes` and `total` deliberately exclude the player's own vote. Being
 * scored against a number you just moved is not a test of anything.
 */
export function slopScore(levelId: string, votes: number, total: number): number {
  const w = PRIOR_WEIGHT;
  return Math.round((priorFor(levelId) * w + total) / (w + Math.max(0, votes)));
}

/** Levels a round may draw from. Secret unlocks stay secret. */
export const POOL: readonly string[] = CATALOG.filter((m) => m.unlock?.kind !== "secret").map((m) => m.id);

/**
 * Five levels from a seed.
 *
 * Deterministic, because the whole point of the format is that two people can
 * compare the same round — a shared link has to deal the same five.
 */
export function dealRound(seed: number): string[] {
  return mulberry32(seed).shuffle([...POOL]).slice(0, ROUNDS);
}

/**
 * Points for one guess.
 *
 * Linear and legible: dead on is 100, and it reaches nothing at fifty points
 * of error, which is as wrong as you can be while still having an opinion.
 */
export function points(guess: number, actual: number): number {
  return Math.max(0, 100 - Math.abs(guess - actual) * 2);
}

export type Band = "bullseye" | "close" | "miss";

export function band(guess: number, actual: number): Band {
  const d = Math.abs(guess - actual);
  return d <= 5 ? "bullseye" : d <= 15 ? "close" : "miss";
}

const SQUARE: Record<Band, string> = { bullseye: "🟩", close: "🟨", miss: "⬜" };

/** The thing people paste. The grid carries it; the number is the argument. */
export function shareText(guesses: readonly { guess: number; actual: number }[], seed: number): string {
  const grid = guesses.map((g) => SQUARE[band(g.guess, g.actual)]).join("");
  const total = guesses.reduce((n, g) => n + points(g.guess, g.actual), 0);
  return [
    `AI Rush · Slop Score #${seed}`,
    `${grid}  ${total}/${guesses.length * 100}`,
    "",
    "Guess how many people think a real product shipped it.",
    "ai-rush.lol/slop",
  ].join("\n");
}
