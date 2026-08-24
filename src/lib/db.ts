import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Supabase, over plain fetch.
 *
 * There is no service-role key anywhere in this app. Every write goes through
 * a `security definer` function in the database, so the publishable key can
 * do exactly what those functions allow and nothing else — no table is
 * reachable directly. The key still never leaves the server; these route
 * handlers are the only caller.
 */

/*
 * These are defaults, not secrets, and env vars override both.
 *
 * A Supabase *publishable* key is meant to be public — in a conventional
 * Supabase app it ships inside the browser bundle. Everything it can reach is
 * bounded by the policy layer, and here that layer allows exactly five things:
 * open a run, submit one (against a server-side ceiling), claim one with its
 * secret, read the public board, and file a level idea. No table is directly
 * readable or writable. Publishing this key changes nothing about what anyone
 * can do.
 */
const URL_ = process.env.SUPABASE_URL ?? "https://zamiayilppjufozhuxev.supabase.co";
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_SMJQPfZRBM9jTRQULEPDhA_tE4Mr219";

export const dbConfigured = Boolean(URL_ && KEY);

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!dbConfigured) throw new Error("supabase_not_configured");
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: KEY!,
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`rpc_${fn}_${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * Ranked rows. The rank is computed in Postgres rather than inferred from
 * array position, so a page showing any slice other than the very top still
 * reports the truth.
 */
export async function boardTop(mercy: boolean, limit: number): Promise<RankedRow[]> {
  if (!dbConfigured) return [];
  try {
    return await rpc<RankedRow[]>("board_top", { p_mercy: mercy, p_limit: limit });
  } catch (err) {
    console.error("[boardTop]", err);
    return [];
  }
}

export interface LiveStats {
  playingNow: number;
  runsToday: number;
  players: number;
  topScore: number;
}

const NO_STATS: LiveStats = { playingNow: 0, runsToday: 0, players: 0, topScore: 0 };

export async function liveStats(): Promise<LiveStats> {
  if (!dbConfigured) return NO_STATS;
  try {
    return await rpc<LiveStats>("live_stats", {});
  } catch (err) {
    console.error("[liveStats]", err);
    return NO_STATS;
  }
}

export interface RankedRow {
  rank: number;
  handle: string;
  score: number;
  levels_solved: number;
  killed_by: string | null;
  seed: string;
  finished_at: string;
}

/**
 * Raw IPs are never written. The salt rotates daily, so the hash cannot be
 * used to follow anyone across days — it only has to hold long enough to
 * rate-limit a ten-minute window.
 */
export async function ipHash(): Promise<string> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "";
    if (!ip) return "";
    const day = new Date().toISOString().slice(0, 10);
    return createHash("sha256").update(`${ip}|${day}|ai-rush`).digest("hex").slice(0, 32);
  } catch {
    return "";
  }
}
