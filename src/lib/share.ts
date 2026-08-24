import type { LevelResult } from "@/engine/types";

/**
 * The post.
 *
 * Every variant contains a number, a named level, and a challenge — that is
 * what makes it legible to someone who has never played. Chosen by run id so
 * re-sharing gives the same text.
 *
 * Copy rules: never "addictive", never 🔥, never more than one emoji. It has
 * to read like a person posting, not a growth team. Slop is the game's
 * aesthetic, not its voice.
 */
export function shareText(opts: {
  score: number;
  solved: number;
  total: number;
  killedBy: string | null;
  rank: number | null;
  url: string;
  pick: number;
}): string {
  const { score, solved, total, killedBy, rank, url, pick } = opts;
  const rankLine = rank ? `Rank #${rank.toLocaleString()}.` : "";

  const variants = [
    `I survived ${solved} of ${total} AI-generated interfaces in 5 minutes.${killedBy ? `\nKilled by "${killedBy}".` : ""} ${rankLine}\nBeat my exact run ↓\n${url}`,
    `Scored ${score.toLocaleString()} on AI Rush.${killedBy ? `\n"${killedBy}" is what finally got me.` : ""} ${rankLine}\n${url}`,
    `The password field made me play an endless runner to collect the letters.\nI got ${solved} of ${total}. ${rankLine}\n${url}`,
    `Five minutes of interfaces designed by something that has seen a million forms and understood none of them.\n${score.toLocaleString()} points. ${rankLine}\n${url}`,
  ];

  if (solved === 0) {
    return `I scored 0 on AI Rush. I did not get past the first screen.\nThe Continue button is red and on the right.\n${url}`;
  }
  return variants[pick % variants.length]!;
}

export function xIntent(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/** The headline on the share card, by how the run actually went. */
export function verdict(solved: number, total: number): string {
  if (solved === 0) return "DID NOT SURVIVE";
  const ratio = solved / Math.max(1, total);
  if (ratio >= 0.9) return "SURVIVED THE INTERFACE";
  if (ratio >= 0.6) return "DANGEROUSLY COMPETENT";
  if (ratio >= 0.3) return "AVERAGE HUMAN. ADEQUATE.";
  return "THE INTERFACE WON";
}

export function causeOfDeath(breakdown: LevelResult[], killedBy: string | null): string | null {
  if (killedBy) return killedBy;
  const worst = breakdown.filter((b) => b.skipped)[0];
  return worst?.title ?? null;
}
