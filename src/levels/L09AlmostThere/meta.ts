import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L09",
  slug: "almost-there",
  title: "Almost There!",
  parodies: "An interstitial ad",
  tier: "annoying",
  family: "meta",
  parSeconds: 12,
  requires: ["pointer"],
  /* The big ✕ already chases the cursor; a fleeing modifier on top of that is
     the same joke twice, and shrink would take the small one below a thumb. */
  incompatibleModifiers: ["fleeing", "shrink", "popups"],
};
