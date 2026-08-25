import { NextResponse } from "next/server";
import { dbConfigured, ipHash, rpc } from "@/lib/db";
import { META_BY_ID } from "@/levels/catalog";
import { slopScore } from "@/slop/score";

export const dynamic = "force-dynamic";

/**
 * Cast a slop vote and hear what everybody else said.
 *
 * The reply is the score computed *without* this vote — see `vote_slop`. The
 * blend with the tier prior happens here rather than in SQL because the prior
 * comes from the catalogue, and half a formula in each place is one place too
 * many.
 *
 * With no database the page still plays: the prior alone is a sensible answer
 * and `offline` says the number is not a crowd's yet.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { levelId?: unknown; score?: unknown };
    const levelId = String(body.levelId ?? "");
    const score = Math.round(Number(body.score));

    /* Rebuilt from our own catalogue rather than trusted: a vote on a level
       that does not exist is a row nothing can ever render. */
    if (!META_BY_ID.has(levelId)) {
      return NextResponse.json({ ok: false, reason: "unknown_level" }, { status: 400 });
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json({ ok: false, reason: "out_of_range" }, { status: 400 });
    }

    if (!dbConfigured) {
      return NextResponse.json({ ok: true, offline: true, votes: 0, score: slopScore(levelId, 0, 0) });
    }

    const r = await rpc<{ ok: boolean; votes?: number; total?: number; reason?: string }>(
      "vote_slop",
      { p_level_id: levelId, p_score: score, p_ip_hash: await ipHash() },
    );
    if (!r.ok) return NextResponse.json(r);

    const votes = r.votes ?? 0;
    return NextResponse.json({
      ok: true,
      votes,
      score: slopScore(levelId, votes, r.total ?? 0),
    });
  } catch (err) {
    /* A vote is not worth a broken round. The client falls back to the prior
       and the player never sees a stack trace. */
    console.error("[slop/vote]", err);
    return NextResponse.json({ ok: false, reason: "error" });
  }
}
