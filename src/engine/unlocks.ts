/**
 * What a player has opened up, and how.
 *
 * Pure, shared verbatim between the client, the deck dealer and the server.
 * Nothing in here reads storage or the network — an unlock state is a value
 * you pass around, which is what lets a challenge link carry one and reproduce
 * somebody else's deck exactly.
 *
 * ── Why any of this is safe ──────────────────────────────────────────────
 *
 * A locked level is worth precisely what its tier is worth. It is new content,
 * not an advantage, and the leaderboard cannot tell the difference between a
 * run that contained one and a run that did not. Everything else follows from
 * that:
 *
 *   - There is no reason to forge an unlock, so the encoding does not need to
 *     resist forgery. `?u=3` in the address bar genuinely does open the share
 *     levels for that one run — and a player who reads the URL and edits it
 *     has done exactly what this game spends five minutes teaching. Let them.
 *   - The unlock state travels in the seed link, so "same seed, same levels,
 *     same order" survives. Opening a friend's challenge link plays their deck
 *     including the levels you have not opened yet, which is a far better
 *     advertisement for them than a description would be.
 *   - The credit that *does* need to be real is counted server-side and never
 *     asserted by the client. See `supabase/migrations/0003_referrals.sql`.
 */

import type { LevelMeta } from "./types";

export interface UnlockState {
  /** Distinct people who have played a run that started from your link. */
  credits: number;
  /** Found, not earned. */
  secret: boolean;
}

export const NOTHING_UNLOCKED: UnlockState = { credits: 0, secret: false };

/** Anything past this is still a credit, it just has nothing left to open. */
export const MAX_CREDITS = 99;

export function isUnlocked(meta: LevelMeta, state: UnlockState): boolean {
  if (!meta.unlock) return true;
  if (meta.unlock.kind === "secret") return state.secret;
  return state.credits >= meta.unlock.credits;
}

/** The next thing sharing would open, if there is one. */
export function nextShareUnlock(
  catalog: readonly LevelMeta[],
  state: UnlockState,
): { meta: LevelMeta; credits: number } | null {
  const locked = catalog
    .filter((m) => m.unlock?.kind === "share" && !isUnlocked(m, state))
    .sort((a, b) => (a.unlock as { credits: number }).credits - (b.unlock as { credits: number }).credits);

  const next = locked[0];
  if (!next) return null;
  return { meta: next, credits: (next.unlock as { credits: number }).credits };
}

/* ── the URL form ─────────────────────────────────────────────────────── */

/**
 * Read an unlock state off a link.
 *
 * Deliberately forgiving and deliberately not signed. See the note above: a
 * hand-edited `u` opens content for that run and wins nothing, so the only
 * thing this has to do is never throw.
 */
export function parseUnlockParams(u: string | undefined, x: string | undefined): UnlockState {
  const credits = Math.max(0, Math.min(MAX_CREDITS, Math.floor(Number(u)) || 0));
  return { credits, secret: x === "1" };
}

/** The other direction, for building a share link. Omits what is default. */
export function unlockParams(state: UnlockState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.credits > 0) out.u = String(Math.min(MAX_CREDITS, state.credits));
  if (state.secret) out.x = "1";
  return out;
}
