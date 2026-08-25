import { NextResponse } from "next/server";
import { dbConfigured, ipHash, rpc } from "@/lib/db";
import { MAX_RUN_EVENTS, scoreRun, validateRun, type DeckEntry, type RunEvent } from "@/engine/scoring";
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
      /** The referral key of whoever's link this player arrived through. */
      ref?: string;
      /** Set by the client when `/api/run/start` opened this in the agent
          tables. Mismatched either way, the submit finds no row and fails
          closed — the two id spaces do not overlap. */
      arena?: boolean;
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

    /*
     * A bound on work, not a truncation.
     *
     * This was `slice(0, 400)`, and a run longer than that was neither
     * rejected nor scored correctly — it was scored on its first 400 events
     * and the player silently lost the rest, because the server rescores from
     * the log it was handed. One event past the limit is now enough for
     * `validateRun` to refuse the whole thing with `too_many_events`, so
     * nothing that reaches this slice is ever scored; the extra element exists
     * only so the overflow is detectable without mapping an unbounded array,
     * and the bounded prefix is still stored for diagnosis.
     */
    const events: RunEvent[] = (body.events ?? []).slice(0, MAX_RUN_EVENTS + 1).map((e) => ({
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
     * An arena run, scored identically and filed elsewhere.
     *
     * Everything above this line is shared on purpose: the same validation,
     * the same deck rebuilt from our own registry, the same pure scoring
     * functions. An agent that was scored by a second implementation would
     * make every row of the asymmetry table a comparison of two games.
     *
     * What it does not get is the referral credit. That is the share-to-unlock
     * mechanism, it is meant to cost somebody five minutes of their life, and
     * a scripted browser is exactly the thing it exists to not be.
     */
    if (body.arena) {
      const result = await rpc<{ ok: boolean; reason?: string }>("submit_agent_run", {
        p_run_id: body.runId,
        p_run_secret: body.runSecret,
        p_events: events,
        p_score: totals?.score ?? 0,
        p_solved: totals?.solved ?? 0,
        p_skipped: totals?.skipped ?? 0,
        p_killed_by: body.killedBy ?? null,
        p_duration_ms: durationMs,
        p_rejection: rejection,
      });
      return NextResponse.json({ ...result, arena: true, score: totals?.score ?? 0 });
    }

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

    /*
     * Credit whoever's link brought this player here.
     *
     * This is the whole share-to-unlock mechanism and this is the only place
     * it can live: the credit is only real if the run is, and the run only
     * becomes real one statement above this one. The database checks the run
     * is `finished` with a score above zero — a number it computed itself from
     * the event log, never one this request carried.
     *
     * A link-preview crawler cannot reach here. It would have to open a run,
     * play a level and post an event log that survives validation. And anyone
     * willing to fake it has to play the game for five minutes on a different
     * network, which is the behaviour the feature exists to cause.
     */
    if (result.ok && typeof body.ref === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(body.ref)) {
      try {
        await rpc("credit_referral", {
          p_key: body.ref,
          p_run_id: body.runId,
          p_ip_hash: await ipHash(),
        });
      } catch (err) {
        /* Somebody's unlock is worth less than somebody's score. Never let a
           referral failure take the run down with it. */
        console.error("[run/finish] credit_referral", err);
      }
    }

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
