import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L18",
  slug: "drag-to-unlock",
  title: "Drag To Unlock",
  parodies: "A slide-to-unlock control",
  tier: "cursed",
  family: "motor",
  parSeconds: 25,
  requires: ["pointer"],
  incompatibleModifiers: ["slippery", "lag", "mirror"],
};
