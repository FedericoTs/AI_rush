import { decodeSeed } from "@/engine/rng";
import { RunClient } from "./RunClient";

/**
 * The seed always arrives in the URL — middleware puts it there. Phase 3
 * swaps this for a server-issued run token and the /r/[seed] challenge route.
 */
export default async function Play({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string; mercy?: string; vs?: string; target?: string }>;
}) {
  const params = await searchParams;
  const decoded = params.seed ? decodeSeed(params.seed) : null;

  /* A challenge is just a seed with someone's name and number attached. No
     matchmaking, no lobby, no waiting for anyone to be online — the rival is
     a number you are running against, and the link is the whole mechanic. */
  const rivalHandle = (params.vs ?? "").replace(/^@+/, "").slice(0, 15);
  const rivalScore = Math.max(0, Math.min(999_999, Number(params.target) || 0));
  const challenge =
    /^[A-Za-z0-9_]{1,15}$/.test(rivalHandle) && rivalScore > 0
      ? { handle: `@${rivalHandle}`, score: rivalScore }
      : null;

  return (
    <RunClient
      seed={decoded?.seed ?? 0}
      mercy={params.mercy === "1"}
      challenge={challenge}
    />
  );
}
