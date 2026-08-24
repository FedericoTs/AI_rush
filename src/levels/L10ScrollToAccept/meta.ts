import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L10",
  slug: "scroll-to-accept",
  title: "Scroll To Accept",
  parodies: "A terms-of-service scroll gate",
  tier: "annoying",
  family: "pick",
  parSeconds: 20,
  requires: ["pointer"],
  /* The solve is a line of body text. Anything that makes text harder to read
     does not make this level harder, it makes it impossible. */
  incompatibleModifiers: ["comic", "rainbow", "shrink", "rotate", "mirror"],
};
