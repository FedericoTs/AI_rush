import { NextResponse } from "next/server";
import { dbConfigured, ipHash, rpc } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Open a run. Returns the id and the secret that authorises submitting and
 * claiming it later — without the secret you cannot touch someone else's run.
 *
 * A missing database is not an error the player should ever see: the game is
 * fully playable without a leaderboard, so this degrades to an unscored run.
 *
 * A run carrying an arena marker opens in the agent tables instead. Same
 * client, same clock, same scoring; a different place to file the result,
 * because the two boards never merge. `src/lib/agent.ts` has the reasoning.
 */
export async function POST(req: Request) {
  if (!dbConfigured) return NextResponse.json({ offline: true });

  try {
    const { seed, caps, mercy, agent } = (await req.json()) as {
      seed?: string; caps?: string; mercy?: boolean;
      agent?: { agent?: string; operator?: string; harness?: string };
    };

    const ip = await ipHash();

    if (agent?.agent) {
      /* The database validates the name properly and raises rather than
         coercing; a malformed one lands here as a thrown rpc error and the
         run goes unscored, which is the right outcome for a harness that
         cannot say what it is. */
      const rows = await rpc<Array<{ run_id: string; run_secret: string }>>("start_agent_run", {
        p_agent: String(agent.agent).slice(0, 40),
        p_operator: agent.operator ? String(agent.operator).slice(0, 16) : null,
        p_harness: agent.harness ? String(agent.harness).slice(0, 40) : null,
        p_seed: String(seed ?? "").slice(0, 32),
        p_ip_hash: ip,
      });
      const row = rows[0];
      if (!row) return NextResponse.json({ offline: true });
      return NextResponse.json({ runId: row.run_id, runSecret: row.run_secret, arena: true });
    }

    const rows = await rpc<Array<{ run_id: string; run_secret: string }>>("start_run", {
      p_seed: String(seed ?? "").slice(0, 32),
      p_caps: String(caps ?? "").slice(0, 8),
      p_mercy: Boolean(mercy),
      p_ip_hash: ip,
    });

    const row = rows[0];
    if (!row) return NextResponse.json({ offline: true });
    return NextResponse.json({ runId: row.run_id, runSecret: row.run_secret });
  } catch (err) {
    console.error('[start_run]', err);
    return NextResponse.json({ offline: true });
  }
}
