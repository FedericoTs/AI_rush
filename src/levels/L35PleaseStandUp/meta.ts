import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L35",
  slug: "please-stand-up",
  title: "Please Stand Up",
  parodies: "A prove-you're-human check",
  tier: "forbidden",
  family: "sensor",
  parSeconds: 40,
  requires: ["motion"],
  /* You will be holding the device at arm's length while turning around. Do
     not also make the screen lie about which way is up. */
  incompatibleModifiers: ["rotate", "mirror", "drift", "slippery", "shrink"],
};
