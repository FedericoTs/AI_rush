import { CATALOG } from "@/levels/catalog";
import { mulberry32 } from "@/engine/rng";

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
 * Our estimate of each level, so the game works before anybody has voted.
 *
 * ── The mistake this replaces ───────────────────────────────────────────
 *
 * These numbers were first derived from tier, on the reasoning that "how far
 * a level goes is inversely how likely anyone is to have met it in the wild".
 * That is wrong, and `LEVELS.md` says so plainly: "a level's *family*
 * describes what it does to you; its *tier* describes how much it costs you".
 * Tier measures cost, not absurdity.
 *
 * It inverted on the flagship. L36 is a completely ordinary, working sign-in
 * form — the most plausible screen in the game — and it is `forbidden` tier
 * because people hunt for a trap in it for a full minute. It opened at 30.
 * L23, an assistant confidently streaming three different verification codes,
 * opened at 45 for the same reason, when that is a thing real products did
 * last week.
 *
 * The deeper problem was that nothing in the catalogue encodes plausibility,
 * because plausibility is precisely what this game asks the crowd. A prior
 * derived from a field that does not contain it was still a guess — just one
 * wearing a data field's clothes, which is worse than an honest guess.
 *
 * ── So these are honest guesses, and labelled as such ────────────────────
 *
 * Hand-authored, one per level, and the screen says "our estimate" until the
 * crowd has outweighed them. That is the right way to handle the objection:
 * label the opinion, do not disguise it.
 *
 * The axis is one question — **does this happen in the real world** — and the
 * answer is the joke. Every level here is equally a parody, but the ones
 * built out of dark patterns score near the top because those patterns are
 * real, and the ones built out of physics score near the bottom. A cookie
 * banner with forty-seven toggles and a Reject All that does nothing is not
 * an exaggeration of anything. A dinosaur dispensing your password is.
 */
const SEED_BY_LEVEL: Record<string, number> = {
  /* Things real products genuinely do. The top of this list is not satire so
     much as reporting, which is the entire point of the game. */
  L36: 95, // a completely normal, working login form. No trick. None.
  L05: 91, // 47 consent toggles; the real ones have 47 consent toggles
  L09: 90, // unskippable ad with a decoy close button — this is the mobile web
  L23: 89, // an assistant streaming three different codes, confidently
  L24: 88, // an 8px free tier below the fold, upsell modal every six seconds
  L01: 88, // the destructive action styled as the primary one
  L28: 87, // "Are you still there?" with a countdown. Every banking site.
  L22: 86, // a progress bar that reaches 99% and falls back
  L39: 84, // dependent dropdowns that reset each other
  L06: 83, // password rules revealed one at a time, as you satisfy them
  L02: 82, // an OTP field that fights your paste and your cursor
  L48: 81, // an accordion that scrolls the section you opened off the screen
  L08: 80, // slot-machine date wheels with momentum, 1900–2099

  /* Real, but exaggerated enough that some people would hesitate. */
  L15: 79, // autocorrect confidently replacing your own name
  L46: 78, // a date range where the two ends fight each other
  L07: 77, // a CAPTCHA whose images will not sit still
  L10: 76, // a terms gate you have to scroll to the end of
  L27: 75, // an address autocomplete ranked worst-first
  L19: 72, // a face-outline overlay that does not fit your face
  L47: 71, // HSL sliders against a target given as an RGB hex
  L04: 72, // "1 to 10 licenses", implemented as a slider
  L30: 73, // a four-step wizard that loses step three
  L34: 70, // a render that failed and left the form strewn across the page
  L49: 68, // a careers page that is a real job offer
  L03: 68, // 195 countries, sorted by population, no search field
  L43: 66, // a seat map where picking one seat moves another
  L45: 64, // a tag field already full of four wrong tags
  L42: 63, // two password fields that disagree with each other
  L32: 62, // 900ms of input lag

  /* The middle: plausible as a bug, implausible as a decision. */
  L21: 60, // stars that lag half a second behind the cursor
  L17: 58, // toasts stacking over the button you need
  L44: 55, // three sliders that sum to a constant
  L41: 48, // a reorder list where every drag moves something else
  L16: 45, // a field where backspace does nothing useful

  /* Physics, not product design. Nobody shipped these and everybody knows it. */
  L40: 32, // an odometer with no minus
  L20: 25, // three fingers on the sensor, held
  L14: 22, // hold your voice inside a narrow band for three seconds
  L18: 20, // slide to unlock, except the track is a maze
  L13: 15, // tilt the device to pour the digits in
  L37: 13, // four brass padlock dials, geared together
  L11: 12, // a playable dinosaur runner where the password hints go
  L26: 11, // tap back a haptic pattern from memory
  L35: 10, // stand up and rotate three hundred and sixty degrees
  L38: 9,  // six meshing gears with one tooth painted red
  L12: 9,  // ten digits, each on its own slider
  L25: 8,  // your input drives two cursors
  L31: 7,  // the entire viewport, mirrored
  L29: 6,  // the fields are invisible; find them by ear
  L33: 5,  // the page rotates, continuously, forever
};

/** Neutral, for a level with no estimate — which a test makes sure is none. */
export const NEUTRAL = 50;

/**
 * How many votes our estimate is worth before the crowd owns the number.
 *
 * Eight, which is small on purpose. These are guesses by one person who has
 * played all forty-nine, and the whole premise of the page is that the crowd
 * knows better — so the estimate should be a starting position that a single
 * evening of traffic buries, not an anchor the real answer has to climb out
 * from under. Until it is outweighed the screen says so.
 */
export const PRIOR_WEIGHT = 8;

export function priorFor(levelId: string): number {
  return SEED_BY_LEVEL[levelId] ?? NEUTRAL;
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
