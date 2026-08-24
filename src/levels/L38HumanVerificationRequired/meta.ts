import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L38",
  slug: "human-verification-required",
  title: "Human Verification Required",
  parodies: "A CAPTCHA widget",
  tier: "unhinged",
  family: "coupled",
  parSeconds: 40,
  requires: ["pointer"],
  incompatibleModifiers: ["rotate", "mirror", "slippery", "shrink"],
};
