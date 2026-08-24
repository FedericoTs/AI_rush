import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L33",
  slug: "this-page-is-rotating",
  title: "This Page Is Rotating",
  parodies: "A checkout form",
  tier: "forbidden",
  family: "motor",
  parSeconds: 40,
  requires: ["pointer"],
  /* It already is the rotate modifier, and mirroring a rotating card makes the
     direction of travel unlearnable rather than difficult. */
  incompatibleModifiers: ["rotate", "mirror", "slippery", "drift", "lag", "shrink"],
};
