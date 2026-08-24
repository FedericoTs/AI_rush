import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L19",
  slug: "upload-a-photo-of-yourself",
  title: "Upload A Photo Of Yourself",
  parodies: "An identity selfie check",
  tier: "cursed",
  family: "sensor",
  parSeconds: 25,
  requires: ["camera"],
  /* The outline already drifts and is already upside down. */
  incompatibleModifiers: ["drift", "rotate", "mirror", "shrink"],
};
