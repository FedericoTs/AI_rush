import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L20",
  slug: "confirm-youre-nearby",
  title: "Confirm You're Nearby",
  parodies: "A biometric prompt",
  tier: "cursed",
  family: "sensor",
  parSeconds: 20,
  requires: ["multitouch"],
  /* It spawns its own popups, and it needs three fingers to stay exactly where
     they were put. */
  incompatibleModifiers: ["popups", "slippery", "drift", "fleeing", "lag"],
};
