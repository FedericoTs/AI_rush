import { NextResponse } from "next/server";
import { dbConfigured, rpc } from "@/lib/db";
import { scoreRun, validateRun, type DeckEntry, type RunEvent } from "@/engine/scoring";
import { META_BY_ID } from "@/levels/catalog";

export const dynamic = "force-dynamic";

/**
 * Finish a run.
 *
 * The client sends its event log and whatever score it thinks it got. Only the
 * log is used: the score is recomputed here with the same pure functions the
 * client ran, and the deck is rebuilt from the registry rather than trusted
 * from the request, so a log referencing levels that do not exist is rejected
 * rather than scored.
 */
export async function POST(req: Request) {
  if (!dbConfigured) return NextResponse.json({ offline: true });

  try {
    const body = (await req.json()) as {
      runId?: string; runSecret?: string;
      events?: RunEvent[]; durationMs?: number; killedBy?: string | null;
    };
    if (!body.runId || !body.runSecret) {
      return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 400 });
    }

    /*
     * Sanitise every number on the way in.
     *
     * Half the columns downstream are integers and the run clock is a float,
     * so a fractional millisecond anywhere in this payload loses the whole run
     * to a cast error — silently, at the last step, after someone has already
     * played for five minutes. Rounding at the client is not enough: this is
     * the boundary, and it is the only place that sees everything.
     */
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
    const durationMs = whole(body.durationMs, 600_000);

    /* The deck comes from our own registry, keyed by the ids the log mentions.
       Nothing about tier or par is taken from the client. */
    const deck: DeckEntry[] = [...new Set(events.map((e) => e.levelId))]
      .map((id) => META_BY_ID.get(id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => ({ levelId: m.id, tier: m.tier, parSeconds: m.parSeconds }));

    const rejection = validateRun(events, deck, durationMs);
    const totals = rejection ? null : scoreRun(events, deck);

    /*
     * A rejected log is filed as rejected, with the reason.
     *
     * It used to be submitted with zeros in every field, which `submit_run`
     * had no way to distinguish from a run somebody was simply bad at — so it
     * went onto the board as a legitimate nought and nothing recorded why.
     * That is exactly how a real twelve-level run was published as a zero.
     */
    const result = await rpc<{ ok: boolean; reason?: string; rank?: number; total?: number }>(
      "submit_run",
      {
        p_run_id: body.runId,
        p_run_secret: body.runSecret,
        p_events: events,
        p_score: totals?.score ?? 0,
        p_solved: totals?.solved ?? 0,
        p_skipped: totals?.skipped ?? 0,
        p_best_combo: totals?.bestCombo ?? 1,
        p_killed_by: body.killedBy ?? null,
        p_duration_ms: durationMs,
        p_rejection: rejection,
      },
    );

    if (rejection) console.error("[run/finish] rejected", { runId: body.runId, rejection });

    return NextResponse.json({
      ...result,
      score: totals?.score ?? 0,
      /* Surfaced as a generic message; the player never sees the reason. */
      rejected: rejection ?? undefined,
    });
  } catch (err) {
    /* The player sees a run that simply did not reach the board. We should
       still be able to find out why without reproducing it. */
    console.error("[run/finish]", err);
    return NextResponse.json({ offline: true });
  }
}
