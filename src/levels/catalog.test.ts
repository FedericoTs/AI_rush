import { describe, expect, it } from "vitest";
import { dealDeck, DECK_SIZE } from "@/engine/deck";
import { CATALOG } from "@/levels/catalog";
import { REGISTRY } from "@/levels/registry";
import type { InputCapability, Tier } from "@/engine/types";

const CAPS = new Set<InputCapability>(["pointer", "keyboard", "touch", "audioOut"]);

describe("the catalogue as shipped", () => {
  it("has fourteen levels, registry and catalog agreeing", () => {
    expect(REGISTRY).toHaveLength(14);
    expect(CATALOG).toHaveLength(14);
    expect(REGISTRY.map((m) => m.meta.id).sort()).toEqual(CATALOG.map((m) => m.id).sort());
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
