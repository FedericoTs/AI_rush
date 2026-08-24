import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L11",
  slug: "choose-a-secure-password",
  title: "Choose A Secure Password 🦖",
  parodies: "A password field with a strength meter",
  tier: "cursed",
  family: "motor",
  parSeconds: 25,
  requires: ["pointer"],
  /* Real-time reactions plus artificial input delay is not a level, it's a wall. */
  incompatibleModifiers: ["lag", "mirror", "slippery", "shrink"],
};
