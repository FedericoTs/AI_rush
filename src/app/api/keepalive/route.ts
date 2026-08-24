import { NextResponse } from "next/server";
import { dbConfigured, liveStats } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Keeps the database awake.
 *
 * Supabase pauses a free-tier project after roughly a week without activity.
 * A paused project does not lose data — it comes back on restore — but the
 * leaderboard is simply gone until someone notices and clicks a button, which
 * is the kind of outage that ends quietly and is discovered late.
 *
 * A once-a-day read is enough to prevent it, and costs nothing. Real traffic
 * makes this redundant; it exists for the quiet weeks, which are exactly when
 * nobody is watching.
 */
export async function GET() {
  if (!dbConfigured) return NextResponse.json({ ok: false, reason: "not_configured" });
  const stats = await liveStats();
  return NextResponse.json({ ok: true, players: stats.players, at: new Date().toISOString() });
}
