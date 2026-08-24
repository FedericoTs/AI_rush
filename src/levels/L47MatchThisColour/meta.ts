import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L47",
  slug: "match-this-colour",
  title: "Match This Colour",
  parodies: "A colour picker",
  tier: "unhinged",
  family: "coupled",
  parSeconds: 40,
  requires: ["pointer"],
  /* Rainbow would recolour the thing being matched, which is not a harder
     level, it is a broken one. */
  incompatibleModifiers: ["rainbow", "slippery", "mirror", "shrink"],
};
