import { NextResponse } from "next/server";
import { dbConfigured, ipHash, rpc } from "@/lib/db";

export const dynamic = "force-dynamic";

const INPUTS = ["touch", "tilt", "mic", "camera", "keyboard", "mouse", "vibration", "sound"];

/**
 * A submitted level idea.
 *
 * The text is stored as text and read by a human. It is never executed, never
 * rendered as HTML, and never fed to a code generator — a submission is a
 * design brief, and that is the whole security boundary. Length limits and the
 * handle shape are enforced here and again in the database.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

    const handle = text(body.handle, 20).replace(/^@+/, "");
    const title = text(body.title, 80);
    const parodies = text(body.parodies, 120);
    const mechanic = text(body.mechanic, 1200);
    const inputs = Array.isArray(body.inputs)
      ? body.inputs.map(String).filter((i) => INPUTS.includes(i)).slice(0, INPUTS.length)
      : [];

    if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
      return NextResponse.json({ ok: false, field: "handle", reason: "That is not a valid X handle." });
    }
    if (title.length < 3) {
      return NextResponse.json({ ok: false, field: "title", reason: "Give it a name — at least 3 characters." });
    }
    if (parodies.length < 3) {
      return NextResponse.json({ ok: false, field: "parodies", reason: "Say what it is pretending to be." });
    }
    if (mechanic.length < 20) {
      return NextResponse.json({
        ok: false,
        field: "mechanic",
        reason: "A bit more detail — at least 20 characters, including how someone beats it.",
      });
    }

    /* Validation runs before the database is consulted. It is pure, it is the
       only feedback the writer gets, and a build without a database should
       still tell someone their handle is wrong rather than swallowing it. */
    if (!dbConfigured) {
      return NextResponse.json({ ok: false, reason: "offline" });
    }

    const result = await rpc<{ ok: boolean; reason?: string }>("submit_level_idea", {
      p_handle: handle,
      p_title: title,
      p_parodies: parodies,
      p_mechanic: mechanic,
      p_inputs: inputs,
      p_ip_hash: await ipHash(),
    });

    if (!result.ok && result.reason === "rate_limited") {
      return NextResponse.json({
        ok: false,
        reason: "Three ideas a day is the limit. Come back tomorrow with a worse one.",
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[lab/submit]", err);
    return NextResponse.json({ ok: false, reason: "Something went wrong on our end. Try again?" });
  }
}
