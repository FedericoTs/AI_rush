import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L28",
  slug: "are-you-still-there",
  title: "Are You Still There?",
  tier: "unhinged",
  family: "motor",
  parSeconds: 30,
  requires: ["pointer"],
  /* It already is the fleeing-button level; layering it would be redundant. */
  incompatibleModifiers: ["fleeing", "slippery", "drift", "lag"],
};
