import { NextResponse } from "next/server";
import { dbConfigured, ipHash, rpc } from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BALLOT = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * A vote, or the removal of one.
 *
 * The ballot is a random id the browser minted about itself (`lib/ballot.ts`) —
 * not a fingerprint, and not anything that identifies a person. The daily IP
 * hash goes along for one purpose only: the per-day cap in the database that
 * makes scripting this tedious. Both are validated here and again in Postgres.
 *
 * Nothing about a vote is secret, so there is no token to check. What stops
 * abuse is that the count decides nothing on its own: a top-voted idea that
 * duplicates an existing level still gets a public "not shipping" on its card.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    const ballot = String(body.ballot ?? "");
    const remove = body.remove === true;

    if (!UUID.test(id)) {
      return NextResponse.json({ ok: false, reason: "bad_id" });
    }
    if (!BALLOT.test(ballot)) {
      /* Storage was blocked, so no ballot could be minted. Say so rather than
         pretending the vote landed — a button that lies is worse than one
         that refuses. */
      return NextResponse.json({ ok: false, reason: "no_ballot" });
    }
    if (!dbConfigured) return NextResponse.json({ ok: false, reason: "offline" });

    const result = remove
      ? await rpc<{ ok: boolean; votes?: number; voted?: boolean }>("unvote_submission", {
          p_id: id,
          p_ballot: ballot,
        })
      : await rpc<{ ok: boolean; votes?: number; voted?: boolean; reason?: string }>(
          "vote_submission",
          { p_id: id, p_ballot: ballot, p_ip_hash: await ipHash() },
        );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[lab/vote]", err);
    return NextResponse.json({ ok: false, reason: "error" });
  }
}
