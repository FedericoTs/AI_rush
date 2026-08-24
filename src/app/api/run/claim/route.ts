import { NextResponse } from "next/server";
import { dbConfigured, rpc } from "@/lib/db";

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
    return NextResponse.json(result);
  } catch (err) {
    console.error("[run/claim]", err);
    return NextResponse.json({ offline: true });
  }
}
