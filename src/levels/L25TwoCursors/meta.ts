import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L25",
  slug: "two-cursors",
  title: "Two Cursors",
  parodies: "A three-field form",
  tier: "unhinged",
  family: "motor",
  parSeconds: 35,
  requires: ["pointer"],
  /* Two pointers is already the maximum amount of pointer confusion a level
     can carry. Anything else aimed at the cursor makes it a coin toss. */
  incompatibleModifiers: ["mirror", "slippery", "drift", "fleeing", "lag", "rotate"],
  /* The deep end of the share ladder: the strangest thing in the catalogue,
     and worth three people actually turning up for. */
  unlock: { kind: "share", credits: 3 },
};
