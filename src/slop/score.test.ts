import { describe, expect, it } from "vitest";
import {
  band, dealRound, NEUTRAL, points, POOL, PRIOR_WEIGHT, priorFor, ROUNDS, shareText, slopScore,
} from "./score";
import { CATALOG, META_BY_ID } from "@/levels/catalog";

describe("the round", () => {
  it("deals five distinct levels", () => {
    const round = dealRound(1234);
    expect(round).toHaveLength(ROUNDS);
    expect(new Set(round).size).toBe(ROUNDS);
  });

  it("deals the same five for the same seed, and different ones otherwise", () => {
    /* The format is two people comparing one round. A link that deals
       something else to the person you sent it to is not a game. */
    expect(dealRound(77)).toEqual(dealRound(77));
    expect(dealRound(77)).not.toEqual(dealRound(78));
  });

  it("never deals a secret level", () => {
    /* L34's job is being found. Putting it in a rotation hands it over. */
    const secrets = CATALOG.filter((m) => m.unlock?.kind === "secret").map((m) => m.id);
    expect(secrets.length).toBeGreaterThan(0);
    for (const s of secrets) expect(POOL).not.toContain(s);
  });

  it("draws only from levels that exist", () => {
    const ids = new Set(CATALOG.map((m) => m.id));
    for (let seed = 0; seed < 50; seed++) {
      for (const id of dealRound(seed)) expect(ids.has(id)).toBe(true);
    }
  });
});

describe("the score itself", () => {
  it("is our estimate when nobody has voted", () => {
    const id = CATALOG[0]!.id;
    expect(slopScore(id, 0, 0)).toBe(priorFor(id));
  });

  it("has an estimate for every level in the catalogue", () => {
    /* A level with no estimate silently falls back to a neutral 50, which is
       indistinguishable on screen from a real opinion. Adding a level must
       mean adding a number for it. */
    const missing = CATALOG.filter((m) => priorFor(m.id) === NEUTRAL);
    expect(missing.map((m) => m.id)).toEqual([]);
  });

  it("does not derive the estimate from tier", () => {
    /*
     * The bug this replaces. These were once derived from tier, on the
     * reasoning that how far a level goes is inversely how likely it is to be
     * real — and `LEVELS.md` says tier measures *cost*, not absurdity.
     *
     * It inverted on the flagship: L36 is an ordinary working login form and
     * is `forbidden` tier because people hunt for a trap in it for a minute,
     * so the most plausible screen in the game opened at 30. If tier ever
     * becomes the source again, these two land on the same number.
     */
    expect(META_BY_ID.get("L36")!.tier).toBe(META_BY_ID.get("L33")!.tier);
    expect(priorFor("L36")).toBeGreaterThan(priorFor("L33") + 50);
  });

  it("puts the honest login form at the top and the rotating page at the bottom", () => {
    /* The two ends of the joke: L36 has no trick at all, and L33 rotates the
       page six degrees a second. If either drifts, the axis has been lost. */
    const ranked = [...CATALOG].sort((a, b) => priorFor(b.id) - priorFor(a.id));
    expect(ranked[0]!.id).toBe("L36");
    expect(ranked.at(-1)!.id).toBe("L33");
  });

  it("scores the dark-pattern levels above the physics levels", () => {
    /*
     * The whole point. Every level is equally a parody, but the ones built
     * out of dark patterns are things that genuinely ship — a consent banner
     * with 47 toggles is reporting, not exaggeration — and the ones built out
     * of physics are not.
     */
    const real = ["L05", "L09", "L24", "L28", "L22"];
    const invented = ["L11", "L25", "L31", "L33", "L38"];
    expect(Math.min(...real.map(priorFor))).toBeGreaterThan(Math.max(...invented.map(priorFor)) + 40);
  });

  it("moves toward the crowd and eventually forgets the prior", () => {
    /* A starting position, not a verdict. Enough real votes and the number
       is entirely theirs. */
    const id = CATALOG[0]!.id;
    const prior = priorFor(id);
    const crowdSays = 20;

    const few = slopScore(id, 4, crowdSays * 4);
    const many = slopScore(id, 400, crowdSays * 400);

    expect(few).toBeLessThan(prior);
    expect(few).toBeGreaterThan(crowdSays);
    /* Never exactly the crowd — a weighted prior always leaves a trace — but
       at four hundred votes it is worth about a point, which is below the
       resolution anyone reads off the screen. */
    expect(Math.abs(many - crowdSays)).toBeLessThanOrEqual(2);
  });

  it("weights the prior at exactly PRIOR_WEIGHT votes", () => {
    const id = CATALOG[0]!.id;
    /* PRIOR_WEIGHT votes of 100 against a prior of p lands halfway. */
    const p = priorFor(id);
    expect(slopScore(id, PRIOR_WEIGHT, 100 * PRIOR_WEIGHT)).toBe(Math.round((p + 100) / 2));
  });

  it("gives an unknown level a neutral 50 rather than throwing", () => {
    expect(slopScore("L99", 0, 0)).toBe(50);
  });

  it("has real spread across the catalogue, which is the whole game", () => {
    /* If every level scored the same there would be nothing to guess. Four
       tier buckets used to satisfy this; forty-nine opinions do it properly. */
    const priors = CATALOG.map((m) => priorFor(m.id));
    expect(new Set(priors).size).toBeGreaterThan(25);
    expect(Math.max(...priors) - Math.min(...priors)).toBeGreaterThan(80);
  });
});

describe("points", () => {
  it("pays full for a bullseye and nothing for being fifty out", () => {
    expect(points(60, 60)).toBe(100);
    expect(points(60, 70)).toBe(80);
    expect(points(10, 60)).toBe(0);
    expect(points(0, 100)).toBe(0); // never negative
  });

  it("bands by how close, not by which side", () => {
    expect(band(50, 50)).toBe("bullseye");
    expect(band(45, 50)).toBe("bullseye");
    expect(band(64, 50)).toBe("close");
    expect(band(36, 50)).toBe("close");
    expect(band(80, 50)).toBe("miss");
  });
});

describe("the share text", () => {
  const round = [
    { guess: 70, actual: 70 }, // 🟩 100
    { guess: 40, actual: 50 }, // 🟨 80
    { guess: 90, actual: 20 }, // ⬜ 0
  ];

  it("leads with the grid and carries the link", () => {
    const text = shareText(round, 41);
    expect(text).toContain("🟩🟨⬜");
    expect(text).toContain("180/300");
    expect(text).toContain("#41");
    expect(text).toContain("ai-rush.lol/slop");
  });

  it("gives away no answers", () => {
    /* The grid says how well you did, never what the numbers were — a share
       that spoils the round kills the thread it is posted in. */
    const text = shareText(round, 41);
    for (const g of round) expect(text).not.toContain(String(g.actual));
  });
});
