import { decodeSeed } from "@/engine/rng";
import { parseUnlockParams } from "@/engine/unlocks";
import { parseLevelSelection } from "@/levels/catalog";
import { RunClient } from "./RunClient";

/**
 * The seed always arrives in the URL — middleware puts it there. Phase 3
 * swaps this for a server-issued run token and the /r/[seed] challenge route.
 */
export default async function Play({
  searchParams,
}: {
  searchParams: Promise<{
    seed?: string;
    mercy?: string;
    vs?: string;
    target?: string;
    level?: string;
    u?: string;
    x?: string;
    k?: string;
  }>;
}) {
  const params = await searchParams;
  const decoded = params.seed ? decodeSeed(params.seed) : null;

  /* `?level=L37`, `?level=L01,L11` or `?level=all` turns this into practice:
     a hand-picked deck, a clock that counts up, and nothing filed anywhere. */
  const practice = parseLevelSelection(params.level);

  /* The deck this link was dealt with, so a challenge reproduces exactly even
     when the sharer had content the visitor has not opened yet. Seeing a
     locked level in someone else's run is a far better advertisement for it
     than a description would be. */
  const unlocks = parseUnlockParams(params.u, params.x);

  /* Whoever's link this is. Carried to /api/run/finish and credited there —
     only if this turns into a real, scored run. */
  const ref = /^[A-Za-z0-9_-]{8,40}$/.test(params.k ?? "") ? params.k! : null;

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
      /* A practice run has no score to chase, so a rival attached to one is
         meaningless — drop it rather than render a bar that can never resolve. */
      challenge={practice ? null : challenge}
      practice={practice}
      unlocks={unlocks}
      ref={ref}
    />
  );
}
