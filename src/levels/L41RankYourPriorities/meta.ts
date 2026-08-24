import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L41",
  slug: "rank-your-priorities",
  title: "Rank Your Priorities",
  parodies: "A drag-to-reorder list",
  tier: "unhinged",
  family: "coupled",
  parSeconds: 45,
  requires: ["pointer"],
  /* You are tracking five positions at once. Anything that makes the list hard
     to read makes it impossible to plan, which is a different level. */
  incompatibleModifiers: ["mirror", "rotate", "slippery", "shrink", "comic"],
};
