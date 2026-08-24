import { NextResponse } from "next/server";
import { dbConfigured, ipHash, rpc } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Open a run. Returns the id and the secret that authorises submitting and
 * claiming it later — without the secret you cannot touch someone else's run.
 *
 * A missing database is not an error the player should ever see: the game is
 * fully playable without a leaderboard, so this degrades to an unscored run.
 */
export async function POST(req: Request) {
  if (!dbConfigured) return NextResponse.json({ offline: true });

  try {
    const { seed, caps, mercy } = (await req.json()) as {
      seed?: string; caps?: string; mercy?: boolean;
    };

    const rows = await rpc<Array<{ run_id: string; run_secret: string }>>("start_run", {
      p_seed: String(seed ?? "").slice(0, 32),
      p_caps: String(caps ?? "").slice(0, 8),
      p_mercy: Boolean(mercy),
      p_ip_hash: await ipHash(),
    });

    const row = rows[0];
    if (!row) return NextResponse.json({ offline: true });
    return NextResponse.json({ runId: row.run_id, runSecret: row.run_secret });
  } catch (err) {
    console.error('[start_run]', err);
    return NextResponse.json({ offline: true });
  }
}
