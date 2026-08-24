import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L03",
  slug: "select-your-country",
  title: "Select Your Country",
  parodies: "A country dropdown",
  tier: "annoying",
  family: "pick",
  parSeconds: 18,
  requires: ["pointer"],
  /* The list already moves under you; drift and lag are the same joke twice. */
  incompatibleModifiers: ["drift", "lag", "slippery"],
};
