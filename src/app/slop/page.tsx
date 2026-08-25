import { SlopClient } from "@/slop/SlopClient";
import { todaysRound } from "@/slop/day";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Slop Score",
  description:
    "Five interfaces. Guess how many people think a real product actually shipped them.",
};

/**
 * The short way in.
 *
 * A five-minute run is a lot to ask of somebody who has just tapped a link,
 * and the numbers say so: of the first thirty-eight runs, ten reached the end
 * and three put a name on the board. Everything shareable this project makes
 * sits behind those five minutes.
 *
 * This sits in front of them. One screen, one slider, ten seconds, and a grid
 * of squares to paste — and the levels it shows are the same forty-nine, so it
 * costs no new content and cannot drift from the game.
 *
 * ── The seed is in the URL ──────────────────────────────────────────────
 *
 * Because the format is two people comparing the same five. A round that deals
 * differently to whoever you sent it to has nothing to argue about.
 */
export default async function Slop({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const parsed = Number((await searchParams).r);
  const explicit = Number.isFinite(parsed) && parsed > 0 && parsed < 1e9;
  /* Anything unparseable becomes today's round rather than an error page — a
     mangled link should still deal somebody a game. */
  const seed = explicit ? Math.floor(parsed) : await todaysRound();

  return <SlopClient seed={seed} key={seed} />;
}
