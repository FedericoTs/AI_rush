import type { LevelMeta } from "@/engine/types";

export const meta: LevelMeta = {
  id: "L16",
  slug: "backspace-unavailable",
  /*
   * Its name in `LEVELS.md`, not the heading it wears.
   *
   * L15 puts the same "Type Your Full Name" form on screen, which is the joke
   * — two levels in the same innocuous disguise doing completely different
   * things to you. But `meta.title` is an identity, not a costume: the
   * leaderboard resolves a cause of death by it, so two levels sharing one
   * would make "killed by …" ambiguous.
   */
  title: "Backspace Unavailable",
  parodies: "An ordinary text field",
  tier: "cursed",
  family: "text",
  parSeconds: 20,
  requires: ["keyboard"],
  incompatibleModifiers: ["lag"],
};
