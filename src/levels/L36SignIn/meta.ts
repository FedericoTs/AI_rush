import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L36",
  slug: "sign-in",
  title: "Sign In",
  parodies: "A login form",
  tier: "forbidden",
  family: "meta",
  parSeconds: 20,
  requires: ["pointer"],
  /* Nothing may be layered on top of this one. A modifier would be a tell,
     and the level is worth 1000 points precisely because it is untouched. */
  incompatibleModifiers: [
    "drift", "confetti", "rainbow", "shrink", "comic", "slippery",
    "popups", "whisper", "fleeing", "lag", "mirror", "rotate",
  ],
};
