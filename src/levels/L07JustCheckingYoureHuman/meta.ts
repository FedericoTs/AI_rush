import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L07",
  slug: "just-checking-youre-human",
  title: "Just Checking You're Human",
  parodies: "An image CAPTCHA",
  tier: "annoying",
  family: "pick",
  parSeconds: 15,
  requires: ["pointer"],
  incompatibleModifiers: ["drift", "slippery"],
};
