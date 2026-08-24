import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L29",
  slug: "adjust-your-volume",
  title: "Adjust Your Volume",
  parodies: "A volume control",
  tier: "unhinged",
  family: "motor",
  parSeconds: 35,
  requires: ["pointer", "audioOut"],
  incompatibleModifiers: ["whisper", "mirror", "rotate", "drift", "shrink"],
};
