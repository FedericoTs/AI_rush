import { describe, expect, it } from "vitest";
import {
  band, dealRound, points, POOL, PRIOR_WEIGHT, priorFor, ROUNDS, shareText, slopScore,
} from "./score";
import { CATALOG } from "@/levels/catalog";

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
  it("is the prior when nobody has voted", () => {
    const id = CATALOG[0]!.id;
    expect(slopScore(id, 0, 0)).toBe(priorFor(id));
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
    /* If every level scored the same there would be nothing to guess. */
    const priors = new Set(CATALOG.map((m) => priorFor(m.id)));
    expect(priors.size).toBeGreaterThan(2);
    expect(Math.max(...priors) - Math.min(...priors)).toBeGreaterThan(30);
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
