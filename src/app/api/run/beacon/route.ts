import { NextResponse } from "next/server";
import { dbConfigured, rpc } from "@/lib/db";
import { validateRun, type DeckEntry, type RunEvent } from "@/engine/scoring";
import { META_BY_ID } from "@/levels/catalog";

export const dynamic = "force-dynamic";

/**
 * A checkpoint from a run that is still going.
 *
 * Sent by the client when the page hides, which is the last moment a browser
 * reliably gives you before a tab closes. It answers the one question the
 * schema could not: of the players who never reach the endgame, where did
 * they stop?
 *
 * It is **not** a finish. Nothing here scores, nothing here can put a row on
 * the board, and the run stays open so the player can come back and submit it
 * properly. See `0006_run_beacon.sql` for why abandonment is a conclusion
 * drawn later rather than a status written now.
 */
export async function POST(req: Request) {
  if (!dbConfigured) return NextResponse.json({ offline: true });

  try {
    const body = (await req.json()) as {
      runId?: string;
      runSecret?: string;
      events?: RunEvent[];
      elapsedMs?: number;
    };
    if (!body.runId || !body.runSecret) {
      return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 400 });
    }

    /* Same sanitising as `finish`, and for the same reason: these columns are
       integers and a fractional millisecond anywhere loses the whole write to
       a cast error. */
    const whole = (v: unknown, max: number) =>
      Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

    const events: RunEvent[] = (body.events ?? []).slice(0, 400).map((e) => ({
      seq: whole(e.seq, 100_000),
      kind: e.kind,
      levelId: String(e.levelId ?? "").slice(0, 16),
      atMs: whole(e.atMs, 900_000),
      ...(e.solveMs === undefined || e.solveMs === null
        ? {}
        : { solveMs: whole(e.solveMs, 900_000) }),
    }));
    const elapsedMs = whole(body.elapsedMs, 600_000);

    /*
     * Validated before it is stored, and dropped rather than filed if it
     * fails.
     *
     * These rows are appended, and `(run_id, seq)` is unique — so whatever a
     * beacon writes at sequence N is what stays there even if the eventual
     * submit disagrees. A log that does not survive the same check `finish`
     * applies has no business getting into the table first and winning.
     *
     * A partial log passes this happily: it checks sequence integrity, deck
     * membership and plausibility, none of which require the run to be over.
     */
    const deck: DeckEntry[] = [...new Set(events.map((e) => e.levelId))]
      .map((id) => META_BY_ID.get(id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => ({ levelId: m.id, tier: m.tier, parSeconds: m.parSeconds }));

    if (validateRun(events, deck, elapsedMs)) {
      return NextResponse.json({ ok: false, reason: "invalid" });
    }

    const result = await rpc<{ ok: boolean; reason?: string }>("beacon_run", {
      p_run_id: body.runId,
      p_run_secret: body.runSecret,
      p_events: events,
      p_duration_ms: elapsedMs,
    });

    return NextResponse.json(result);
  } catch (err) {
    /* Telemetry is never worth a visible failure. The player is mid-run, or
       has already closed the tab. */
    console.error("[run/beacon]", err);
    return NextResponse.json({ offline: true });
  }
}
