import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L23",
  slug: "ai-is-generating-your-code",
  title: "AI Is Generating Your Code",
  parodies: "An assistant streaming a reply",
  tier: "unhinged",
  family: "meta",
  parSeconds: 40,
  requires: ["pointer", "keyboard"],
  /* The solve is reading a footnote. Anything that makes small text harder to
     read does not raise the difficulty, it removes the solve. */
  incompatibleModifiers: ["comic", "rainbow", "shrink", "rotate", "mirror"],
  /* The first thing sharing opens. It is the most screenshotable level in the
     game, which is not a coincidence — the reward for bringing someone in is
     the level most likely to bring the next one in. */
  unlock: { kind: "share", credits: 1 },
};
