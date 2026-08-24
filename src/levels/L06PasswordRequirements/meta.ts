import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L06",
  slug: "password-requirements",
  title: "Password Requirements",
  parodies: "A live-validating password field",
  tier: "annoying",
  family: "text",
  parSeconds: 25,
  requires: ["keyboard"],
  collects: ["credentials"],
  /* Typing under artificial input delay is not a puzzle, it is a wall. */
  incompatibleModifiers: ["lag", "mirror"],
};
