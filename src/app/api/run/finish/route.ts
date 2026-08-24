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

    const events = (body.events ?? []).slice(0, 400);
    const durationMs = Math.max(0, Math.min(600_000, Number(body.durationMs) || 0));

    /* The deck comes from our own registry, keyed by the ids the log mentions.
       Nothing about tier or par is taken from the client. */
    const deck: DeckEntry[] = [...new Set(events.map((e) => e.levelId))]
      .map((id) => META_BY_ID.get(id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => ({ levelId: m.id, tier: m.tier, parSeconds: m.parSeconds }));

    const rejection = validateRun(events, deck, durationMs);
    const totals = rejection ? null : scoreRun(events, deck);

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
      },
    );

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
