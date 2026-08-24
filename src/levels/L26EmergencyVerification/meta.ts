import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L26",
  slug: "emergency-verification",
  title: "Emergency Verification",
  parodies: "A 2FA push prompt",
  tier: "unhinged",
  family: "sensor",
  parSeconds: 35,
  /*
   * Pointer only, and haptics deliberately absent.
   *
   * `navigator.vibrate` does not exist on any iOS Safari, so gating on it
   * would put the majority of phone players on a fallback for a level whose
   * flash-and-audio path is not a fallback at all — it is the primary
   * delivery, built first, identical in difficulty. The level asks the
   * adapter what it has and plays the pattern whichever way it can.
   */
  requires: ["pointer"],
  /* Rhythm input under lag or a moving button is not a harder level, it is a
     different and much worse one. */
  incompatibleModifiers: ["lag", "fleeing", "slippery", "drift", "mirror"],
};
