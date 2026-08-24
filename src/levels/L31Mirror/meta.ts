import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L31",
  slug: "mirror",
  title: "Mirror",
  parodies: "A login form",
  tier: "forbidden",
  family: "motor",
  parSeconds: 40,
  requires: ["pointer", "keyboard"],
  /* A sign-in form, mirrored. Still a sign-in form to a password manager. */
  collects: ["credentials"],
  /* It already is the mirror modifier. Rotating a mirrored card is not harder,
     it is unreadable, and lag turns a motor challenge into a wall. */
  incompatibleModifiers: ["mirror", "rotate", "lag", "slippery", "shrink"],
};
