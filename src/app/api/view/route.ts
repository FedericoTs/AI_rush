import { NextResponse } from "next/server";
import { dbConfigured, ipHash, rpc } from "@/lib/db";
import { siteHost } from "@/lib/site";
import { isArrival, normalisePath, refHost } from "@/visits/paths";

export const dynamic = "force-dynamic";

/**
 * A visit.
 *
 * Both fields arrive from a browser and neither is trusted: the path is folded
 * onto the fixed set of routes that exist, and the referrer is reduced to a
 * bare hostname with our own dropped, before either reaches the database. See
 * `src/visits/paths.ts` for why, and `0009_page_views.sql` for what is
 * deliberately not collected.
 *
 * Always answers `ok`. A counter that reports a failure to the page it is
 * counting has its priorities backwards.
 */
export async function POST(req: Request) {
  try {
    if (!dbConfigured) return NextResponse.json({ ok: true, offline: true });

    const body = (await req.json()) as { path?: unknown; ref?: unknown; first?: unknown };
    const path = normalisePath(String(body.path ?? ""));
    const referrer = String(body.ref ?? "");
    const self = siteHost();

    /* Both conditions, for the two different ways a view can fail to be an
       arrival: a client-side navigation (not first in this document) and a
       full-load navigation between our own pages, which a redirect like
       `/play`'s seed causes. See `isArrival`. */
    const entry = isArrival(body.first === true, referrer, self);
    /* Only an arrival carries a source — otherwise whoever linked to the
       first page gets credited with every click after it. */
    const ref = entry ? refHost(referrer, self) : null;

    await rpc("record_view", {
      p_path: path,
      p_ref_host: ref,
      p_entry: entry,
      p_ip_hash: await ipHash(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[view]", err);
    return NextResponse.json({ ok: true });
  }
}
