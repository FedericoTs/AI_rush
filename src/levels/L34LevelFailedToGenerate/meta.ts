import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L34",
  slug: "level-failed-to-generate",
  title: "Level Failed To Generate",
  parodies: "A page that crashed while rendering",
  tier: "forbidden",
  family: "meta",
  parSeconds: 45,
  requires: ["pointer"],
  /*
   * The level is already the broken-layout joke. Anything that breaks the
   * layout further does not raise the difficulty, it removes the signal the
   * player is using to reassemble the form.
   */
  incompatibleModifiers: ["rotate", "mirror", "slippery", "drift", "shrink", "comic"],
};
