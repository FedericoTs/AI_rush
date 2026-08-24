import { NextResponse } from "next/server";
import { dbConfigured, ipHash, rpc } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Attach an @handle to a finished run. Kept separate so the tally never waits. */
export async function POST(req: Request) {
  if (!dbConfigured) return NextResponse.json({ offline: true });

  try {
    const { runId, runSecret, handle } = (await req.json()) as {
      runId?: string; runSecret?: string; handle?: string;
    };
    if (!runId || !runSecret || !handle) {
      return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
    }

    const result = await rpc<{ ok: boolean; reason?: string; handle?: string; rank?: number; total?: number }>(
      "claim_run",
      { p_run_id: runId, p_run_secret: runSecret, p_handle: String(handle).slice(0, 20) },
    );
    if (!result.ok) return NextResponse.json(result);

    /*
     * Mint the referral key here, at the one moment a player has a name.
     *
     * Handles in this game are typed, not verified — anyone can claim to be
     * anyone — so a handle cannot own anything. The key can: it is a bearer
     * secret, it is the only thing that can read a credit count, and it is
     * what travels inside a share link. It is stable per handle, so claiming
     * a second run keeps the same key and the same unlocks.
     *
     * A failure here costs the player their unlocks, not their place on the
     * board, so it must never take the claim down with it.
     */
    let key: string | null = null;
    try {
      const minted = await rpc<{ ok: boolean; key?: string }>("referral_key", {
        p_handle: String(handle).slice(0, 20),
        p_ip_hash: await ipHash(),
      });
      key = minted.ok ? (minted.key ?? null) : null;
    } catch (err) {
      console.error("[run/claim] referral_key", err);
    }

    return NextResponse.json({ ...result, key });
  } catch (err) {
    console.error("[run/claim]", err);
    return NextResponse.json({ offline: true });
  }
}
