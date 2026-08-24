import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L40",
  slug: "confirm-quantity",
  title: "Confirm Quantity",
  parodies: "A numeric stepper",
  tier: "annoying",
  family: "coupled",
  parSeconds: 20,
  requires: ["pointer"],
  incompatibleModifiers: ["slippery", "shrink"],
};
