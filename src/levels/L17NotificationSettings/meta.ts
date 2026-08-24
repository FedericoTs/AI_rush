import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L17",
  slug: "notification-settings",
  title: "Notification Settings",
  parodies: "A toast notification stack",
  tier: "cursed",
  family: "meta",
  parSeconds: 25,
  requires: ["pointer"],
  incompatibleModifiers: ["popups", "confetti", "drift"],
};
