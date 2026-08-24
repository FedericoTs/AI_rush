import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L13",
  slug: "confirm-with-a-gesture",
  title: "Confirm With A Gesture",
  parodies: "A shake-to-undo prompt",
  tier: "cursed",
  family: "sensor",
  parSeconds: 20,
  requires: ["motion"],
  /* A spirit level under drift or rotation is not harder, it is unreadable —
     the whole mechanic is knowing which way is level. */
  incompatibleModifiers: ["drift", "rotate", "mirror", "slippery", "lag"],
};
