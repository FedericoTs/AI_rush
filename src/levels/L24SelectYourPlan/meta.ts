import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L24",
  slug: "select-your-plan",
  title: "Select Your Plan",
  parodies: "A pricing table",
  tier: "unhinged",
  family: "pick",
  parSeconds: 35,
  requires: ["pointer"],
  /* It generates its own popups on a timer; the modifier would be the same
     joke twice. Shrink would take an already-8px link past readable. */
  incompatibleModifiers: ["popups", "shrink", "comic"],
};
