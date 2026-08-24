import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L32",
  slug: "network-conditions",
  title: "Network Conditions",
  parodies: "A four-field form",
  tier: "forbidden",
  family: "motor",
  parSeconds: 45,
  requires: ["pointer", "keyboard"],
  /* It already is the lag modifier, and lag on top of anything that needs
     aiming stops being a level. */
  incompatibleModifiers: ["lag", "fleeing", "slippery", "drift", "mirror", "rotate"],
};
