import { describe, expect, it } from "vitest";
import { dealDeck, DECK_SIZE } from "@/engine/deck";
import { CATALOG, parseLevelSelection } from "@/levels/catalog";
import { REGISTRY } from "@/levels/registry";
import type { InputCapability, Tier } from "@/engine/types";

const CAPS = new Set<InputCapability>(["pointer", "keyboard", "touch", "audioOut"]);

describe("the catalogue as shipped", () => {
  /* The count is not the assertion — the two lists agreeing is. A level in the
     registry and not the catalogue is a level the server cannot score. */
  it("keeps registry and catalogue in step", () => {
    expect(REGISTRY.length).toBe(CATALOG.length);
    expect(REGISTRY.map((m) => m.meta.id).sort()).toEqual(CATALOG.map((m) => m.id).sort());
    expect(new Set(CATALOG.map((m) => m.id)).size).toBe(CATALOG.length);
  });

  /* Past this the dealer stops repeating itself: DECK_SIZE playable levels
     plus the Honest Level, which is dealt from outside the general pool. */
  it("has enough levels to fill a whole deck without reaching", () => {
    expect(CATALOG.filter((m) => m.id !== "L36").length).toBeGreaterThanOrEqual(DECK_SIZE);
  });

  it("covers every tier, so the deck never has to draw off-tier", () => {
    const tiers = new Set(CATALOG.map((m) => m.tier));
    for (const t of ["annoying", "cursed", "unhinged", "forbidden"] as Tier[]) {
      expect(tiers.has(t)).toBe(true);
    }
  });

  it("has enough openers to fill the first window without repeating", () => {
    expect(CATALOG.filter((m) => m.tier === "annoying").length).toBeGreaterThanOrEqual(4);
  });

  /*
   * The Honest Level is dealt separately and appears in one run in eight, so
   * it is not in the general pool. With fourteen levels that leaves thirteen
   * to draw from, and a deck cannot exceed what exists without repeating —
   * which it must never do.
   *
   * Thirteen is comfortably past what anyone reaches in five minutes: it would
   * take a 23-second average across the whole run. Once the catalogue passes
   * fifteen levels this becomes a full DECK_SIZE every time.
   */
  it("deals as deep as the catalogue allows, never repeating", () => {
    const pool = CATALOG.filter((m) => m.id !== "L36").length;
    const expected = Math.min(DECK_SIZE, pool);

    for (let seed = 0; seed < 300; seed++) {
      const deck = dealDeck({ seed, registry: REGISTRY, capabilities: CAPS });
      expect(deck.length).toBeGreaterThanOrEqual(expected);
      expect(new Set(deck.map((d) => d.module.meta.id)).size).toBe(deck.length);
    }
  });

  it("deals deeper than any five-minute run could reach", () => {
    /* Fourteen levels at the shortest pars in the catalogue is the theoretical
       ceiling; nobody gets near it. Twelve is the honest safety margin. */
    for (let seed = 0; seed < 100; seed++) {
      const deck = dealDeck({ seed, registry: REGISTRY, capabilities: CAPS });
      expect(deck.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("respects the tier ramp now that every tier is populated", () => {
    let offTierEarly = 0;
    for (let seed = 0; seed < 300; seed++) {
      const deck = dealDeck({ seed, registry: REGISTRY, capabilities: CAPS });
      expect(deck[0]!.module.meta.tier).toBe("annoying");
      /* Nothing forbidden or unhinged should surface in the opening window. */
      if (deck.slice(0, 3).some((d) => ["unhinged", "forbidden"].includes(d.module.meta.tier))) {
        offTierEarly++;
      }
    }
    expect(offTierEarly).toBe(0);
  });

  it("keeps consecutive families apart almost always", () => {
    let adjacent = 0, pairs = 0;
    for (let seed = 0; seed < 300; seed++) {
      const deck = dealDeck({ seed, registry: REGISTRY, capabilities: CAPS });
      for (let i = 1; i < deck.length; i++) {
        pairs++;
        if (deck[i]!.module.meta.family === deck[i - 1]!.module.meta.family) adjacent++;
      }
    }
    expect(adjacent / pairs).toBeLessThan(0.06);
  });
});

/**
 * The level index and the practice links it hands out.
 *
 * Everything here is driven by a `?level=`/`/levels/:id` string that arrives
 * from outside, so the parser is the boundary and gets tested like one.
 */
describe("level selection from a URL", () => {
  it("returns null when nothing is selected, which is what deals an ordinary run", () => {
    expect(parseLevelSelection(undefined)).toBeNull();
    expect(parseLevelSelection("")).toBeNull();
  });

  it("expands `all` to the whole catalogue, in catalogue order", () => {
    expect(parseLevelSelection("all")).toEqual(CATALOG.map((m) => m.id));
    expect(parseLevelSelection("ALL")).toEqual(CATALOG.map((m) => m.id));
  });

  it("takes a single level", () => {
    expect(parseLevelSelection("L37")).toEqual(["L37"]);
    expect(parseLevelSelection("l37")).toEqual(["L37"]);
  });

  it("takes a hand-written list and keeps the order given", () => {
    expect(parseLevelSelection("L37,L01, L11")).toEqual(["L37", "L01", "L11"]);
  });

  it("drops duplicates, because a deck must never repeat a level", () => {
    expect(parseLevelSelection("L01,L01,L02")).toEqual(["L01", "L02"]);
  });

  /* A stale link to a level that was later renumbered should still play the
     rest of what it names rather than 404 the whole room. */
  it("drops ids that do not exist, and rejects a selection of only those", () => {
    expect(parseLevelSelection("L01,L99")).toEqual(["L01"]);
    expect(parseLevelSelection("L99")).toBeNull();
    expect(parseLevelSelection("../../etc/passwd")).toBeNull();
  });

  it("names every id in the catalogue", () => {
    for (const m of CATALOG) expect(parseLevelSelection(m.id)).toEqual([m.id]);
  });
});

describe("what the index is allowed to show", () => {
  /* The index shows only what a level pretends to be. The whole game is the
     second and a half before you realise, and an index that gave away the
     mechanic would sell that for nothing. */
  it("gives every level a parodies line", () => {
    for (const m of CATALOG) {
      expect(m.parodies.length).toBeGreaterThan(3);
      expect(m.parodies).not.toContain(m.title);
    }
  });

  it("keeps titles unique, which is what lets a cause of death resolve to a level", () => {
    expect(new Set(CATALOG.map((m) => m.title)).size).toBe(CATALOG.length);
  });
});
