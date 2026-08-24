import { NextResponse } from "next/server";
import { dbConfigured, ipHash, rpc } from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "That is my handle and I did not write that."
 *
 * Handles here are typed, never verified — that is a deliberate choice made to
 * keep the intake frictionless, and this is the bill for it. Somebody's name
 * can end up on words they never wrote, and they need to be able to take it
 * down without an account, without an email, and without waiting.
 *
 * So the card is hidden the moment this is called, and a human reviews it
 * afterwards. Somebody could use that to grief a good submission into
 * invisibility for a few days; that is a real cost and it is the right one to
 * pay, because the two mistakes are not the same size. A good idea hidden
 * until Friday costs the queue nothing. A stranger's handle sitting on a
 * paragraph they did not write is not something you can apologise your way out
 * of afterwards.
 *
 * The database caps this at three a day per address, which leaves it usable by
 * a person clearing up an impersonation and tedious for anyone using it as a
 * delete button.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    const reason = String(body.reason ?? "").trim().slice(0, 600);

    if (!UUID.test(id)) return NextResponse.json({ ok: false, reason: "bad_id" });
    if (!dbConfigured) return NextResponse.json({ ok: false, reason: "offline" });

    const result = await rpc<{ ok: boolean; reason?: string }>("request_takedown", {
      p_id: id,
      p_reason: reason,
      p_ip_hash: await ipHash(),
    });

    if (!result.ok && result.reason === "rate_limited") {
      return NextResponse.json({
        ok: false,
        reason: "Three takedown requests a day from one address. Email us if you need more.",
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[lab/remove]", err);
    return NextResponse.json({ ok: false, reason: "error" });
  }
}
