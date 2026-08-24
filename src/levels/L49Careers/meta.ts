import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L49",
  slug: "careers",
  title: "Careers",
  parodies: "A job application",
  tier: "forbidden",
  family: "meta",
  parSeconds: 30,
  requires: ["pointer"],
  /* The whole level is three questions about interfaces lying to you. A
     modifier making this one lie as well would only muddy it. */
  incompatibleModifiers: [
    "drift", "rainbow", "shrink", "comic", "slippery",
    "popups", "fleeing", "lag", "mirror", "rotate",
  ],
  /* Not earned. Found — by clicking the duplicate "Careers" in the footer that
     every level has carried since the first one shipped. */
  unlock: { kind: "secret" },
};
