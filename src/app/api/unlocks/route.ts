import { NextResponse } from "next/server";
import { dbConfigured, rpc } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * How many people have actually turned up through your link.
 *
 * The key is a bearer secret: holding it is the whole authorisation, which is
 * the only model available in a game with no accounts and unverified handles.
 * It reveals one number and the handle it belongs to — both of which the
 * holder already knows — so a leaked key costs its owner nothing.
 *
 * The client never asserts this count. It reads one the database computed from
 * runs it scored itself.
 */
export async function GET(req: Request) {
  if (!dbConfigured) return NextResponse.json({ offline: true, credits: 0 });

  const key = new URL(req.url).searchParams.get("k") ?? "";
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(key)) {
    return NextResponse.json({ ok: false, reason: "bad_key" }, { status: 400 });
  }

  try {
    const result = await rpc<{ ok: boolean; handle?: string; credits?: number }>(
      "referral_status",
      { p_key: key },
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[unlocks]", err);
    /* Never take somebody's content away because a request failed — the client
       keeps whatever it had cached. */
    return NextResponse.json({ offline: true });
  }
}
