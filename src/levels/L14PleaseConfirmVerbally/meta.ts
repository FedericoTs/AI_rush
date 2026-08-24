import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L14",
  slug: "please-confirm-verbally",
  title: "Please Confirm Verbally",
  parodies: "Voice verification",
  tier: "cursed",
  family: "sensor",
  parSeconds: 20,
  requires: ["audioIn"],
  /* Holding a level steady for three seconds is the mechanic; anything that
     moves the target or the hand is the same joke twice. */
  incompatibleModifiers: ["drift", "slippery", "lag", "mirror", "whisper"],
};
