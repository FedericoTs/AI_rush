import { describe, expect, it } from "vitest";
import { dealDeck, DECK_SIZE, HONEST_LEVEL_ID, PACE, practiceDeck, type CapabilitySet } from "./deck";
import { MODIFIERS } from "./chaos/modifiers";
import { REGISTRY as SHIPPED } from "@/levels/registry";
import type { Family, InputCapability, LevelModule, Tier } from "./types";

/* Synthetic catalogue. Deliberately not the real registry — the dealer's rules
   must hold for any content, and these tests should not break when a level
   is retired. */
function fake(
  id: string,
  tier: Tier,
  family: Family,
  requires: InputCapability[] = [],
  withFallback = true,
): LevelModule {
  const Component = () => null;
  return {
    meta: {
      id, slug: id.toLowerCase(), title: id, parodies: `a fake ${family} interface`,
      tier, family, parSeconds: 20, requires, incompatibleModifiers: [],
    },
    Component,
    ...(withFallback && requires.length ? { Fallback: Component } : {}),
  };
}

const REGISTRY: LevelModule[] = [
  ...Array.from({ length: 6 }, (_, i) => fake(`A${i}`, "annoying", i % 2 ? "text" : "pick")),
  ...Array.from({ length: 6 }, (_, i) => fake(`C${i}`, "cursed", i % 2 ? "motor" : "meta")),
  ...Array.from({ length: 4 }, (_, i) => fake(`K${i}`, "cursed", "coupled")),
  ...Array.from({ length: 5 }, (_, i) => fake(`U${i}`, "unhinged", i % 2 ? "pick" : "meta")),
  ...Array.from({ length: 3 }, (_, i) => fake(`F${i}`, "forbidden", "motor")),
  fake("MIC", "cursed", "sensor", ["audioIn"]),
  fake("CAM", "cursed", "sensor", ["camera"]),
  fake("GYRO", "cursed", "sensor", ["motion"]),
  fake("HARD", "unhinged", "sensor", ["motion"], false), // no fallback: excluded without motion
  { ...fake(HONEST_LEVEL_ID, "forbidden", "meta"), meta: { ...fake(HONEST_LEVEL_ID, "forbidden", "meta").meta, parSeconds: 20 } },
];

const ALL: CapabilitySet = new Set<InputCapability>([
  "pointer", "keyboard", "touch", "multitouch", "motion", "audioIn", "camera", "haptics", "audioOut",
]);
const NONE: CapabilitySet = new Set<InputCapability>(["pointer"]);

const deal = (seed: number, caps = ALL, mercy = false) =>
  dealDeck({ seed, registry: REGISTRY, capabilities: caps, mercy });

describe("dealDeck", () => {
  it("is fully determined by the seed", () => {
    const a = deal(4242).map((d) => `${d.module.meta.id}:${d.modifiers.join("+")}`);
    const b = deal(4242).map((d) => `${d.module.meta.id}:${d.modifiers.join("+")}`);
    expect(a).toEqual(b);
  });

  it("gives different seeds different runs", () => {
    const a = deal(1).map((d) => d.module.meta.id);
    const b = deal(2).map((d) => d.module.meta.id);
    expect(a).not.toEqual(b);
  });

  it("never repeats a level inside one run", () => {
    for (let seed = 0; seed < 300; seed++) {
      const ids = deal(seed).map((d) => d.module.meta.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("deals past the clock so a fast player never runs out", () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(deal(seed).length).toBe(DECK_SIZE);
    }
  });

  it("ramps tiers — it opens on annoying and does not open on forbidden", () => {
    for (let seed = 0; seed < 200; seed++) {
      const deck = deal(seed);
      expect(deck[0]!.module.meta.tier).toBe("annoying");
      expect(deck.slice(0, 3).some((d) => d.module.meta.tier === "forbidden")).toBe(false);
    }
  });

  it("keeps two coupled levels from becoming a puzzle game", () => {
    for (let seed = 0; seed < 300; seed++) {
      const coupled = deal(seed).filter((d) => d.module.meta.family === "coupled");
      expect(coupled.length).toBeLessThanOrEqual(2);
    }
  });

  it("asks for at most one permission per run", () => {
    for (let seed = 0; seed < 300; seed++) {
      const asks = deal(seed).filter((d) =>
        d.module.meta.requires.some((r) => r === "audioIn" || r === "camera"),
      );
      expect(asks.length).toBeLessThanOrEqual(1);
    }
  });

  it("avoids back-to-back levels of the same family while candidates exist", () => {
    let adjacent = 0, pairs = 0;
    for (let seed = 0; seed < 300; seed++) {
      const deck = deal(seed);
      for (let i = 1; i < deck.length; i++) {
        pairs++;
        if (deck[i]!.module.meta.family === deck[i - 1]!.module.meta.family) adjacent++;
      }
    }
    /* The rule is relaxable rather than absolute — a short run is worse than an
       awkward adjacency — so this asserts it holds overwhelmingly, not always. */
    expect(adjacent / pairs).toBeLessThan(0.05);
  });

  it("shows the Honest Level rarely, and never early", () => {
    let runsWithIt = 0;
    for (let seed = 0; seed < 800; seed++) {
      const deck = deal(seed);
      const at = deck.findIndex((d) => d.module.meta.id === HONEST_LEVEL_ID);
      if (at >= 0) {
        runsWithIt++;
        const nominalSec = deck.slice(0, at).reduce((t, d) => t + d.module.meta.parSeconds, 0);
        /* Two minutes of *clock*, which is what §5 says — hence PACE. */
        expect(nominalSec * PACE).toBeGreaterThanOrEqual(120);
      }
    }
    expect(runsWithIt / 800).toBeGreaterThan(0.04);
    expect(runsWithIt / 800).toBeLessThan(0.22);
  });
});

describe("capability gating", () => {
  it("still deals a full run when every permission is denied", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(deal(seed, NONE).length).toBe(DECK_SIZE);
    }
  });

  it("marks levels degraded rather than dropping them, when a fallback exists", () => {
    const deck = deal(11, NONE);
    for (const d of deck) {
      const missing = d.module.meta.requires.filter((r) => !NONE.has(r));
      expect(d.degraded).toBe(missing.length > 0);
      if (d.degraded) expect(d.module.Fallback).toBeTruthy();
    }
  });

  it("excludes a sensor level with no fallback path at all", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(deal(seed, NONE).some((d) => d.module.meta.id === "HARD")).toBe(false);
    }
  });
});

describe("mercy mode", () => {
  it("never asks for a microphone or a camera", () => {
    for (let seed = 0; seed < 200; seed++) {
      const deck = deal(seed, ALL, true);
      const asks = deck.filter((d) =>
        d.module.meta.requires.some((r) => r === "audioIn" || r === "camera"),
      );
      expect(asks).toHaveLength(0);
    }
  });

  it("never schedules a modifier that mercy mode exists to remove", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const d of deal(seed, ALL, true)) {
        for (const m of d.modifiers) expect(MODIFIERS[m].mercyOff).toBe(false);
      }
    }
  });

  it("still deals a full run", () => {
    expect(deal(7, ALL, true).length).toBe(DECK_SIZE);
  });
});

describe("chaos schedule", () => {
  it("holds modifiers back until two minutes in", () => {
    for (let seed = 0; seed < 200; seed++) {
      const deck = deal(seed);
      let nominal = 0;
      for (const d of deck) {
        if (nominal * PACE < 120) expect(d.modifiers).toHaveLength(0);
        nominal += d.module.meta.parSeconds;
      }
    }
  });

  it("never stacks more than two at once", () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const d of deal(seed)) expect(d.modifiers.length).toBeLessThanOrEqual(2);
    }
  });

  it("never applies a modifier a level already is", () => {
    const mirrorLevel: LevelModule = {
      ...fake("MIRROR", "forbidden", "motor"),
      meta: { ...fake("MIRROR", "forbidden", "motor").meta, incompatibleModifiers: ["mirror", "lag"] },
    };
    for (let seed = 0; seed < 300; seed++) {
      const deck = dealDeck({
        seed, registry: [...REGISTRY, mirrorLevel], capabilities: ALL,
      });
      const found = deck.find((d) => d.module.meta.id === "MIRROR");
      if (found) {
        expect(found.modifiers).not.toContain("mirror");
        expect(found.modifiers).not.toContain("lag");
      }
    }
  });

  it("never repeats a modifier within one level", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const d of deal(seed)) {
        expect(new Set(d.modifiers).size).toBe(d.modifiers.length);
      }
    }
  });
});

/**
 * Practice.
 *
 * A hand-picked deck rather than a dealt one. Everything the dealer exists to
 * do — tier ramps, family spacing, the Honest Level roll, chaos modifiers — is
 * deliberately absent, because none of it is what someone wants when they are
 * trying to work out how one particular level works.
 */
describe("practiceDeck", () => {
  it("plays exactly what it was asked for, in the order it was asked", () => {
    const deck = practiceDeck({ registry: REGISTRY, ids: ["U0", "A3", "C1"], capabilities: ALL });
    expect(deck.map((d) => d.module.meta.id)).toEqual(["U0", "A3", "C1"]);
  });

  it("carries no modifiers — a level under chaos is a different level", () => {
    const deck = practiceDeck({ registry: REGISTRY, ids: REGISTRY.map((m) => m.meta.id), capabilities: ALL });
    for (const d of deck) expect(d.modifiers).toEqual([]);
  });

  /* Ids come off a URL, and a link to a level that was later renumbered should
     still play the rest of what it names rather than 404 the whole room. */
  it("drops ids it does not recognise instead of failing", () => {
    const deck = practiceDeck({ registry: REGISTRY, ids: ["A0", "NOPE", "A1"], capabilities: ALL });
    expect(deck.map((d) => d.module.meta.id)).toEqual(["A0", "A1"]);
  });

  it("allows the Honest Level to be practised directly", () => {
    const deck = practiceDeck({ registry: REGISTRY, ids: [HONEST_LEVEL_ID], capabilities: ALL });
    expect(deck).toHaveLength(1);
    expect(deck[0]!.module.meta.id).toBe(HONEST_LEVEL_ID);
  });

  /* The degraded path is still the degraded path: practising a microphone
     level on a device with no microphone must render the fallback, not the
     level with a dead input. */
  it("marks a level degraded when the device cannot meet it", () => {
    const [ok] = practiceDeck({ registry: REGISTRY, ids: ["MIC"], capabilities: ALL });
    const [poor] = practiceDeck({ registry: REGISTRY, ids: ["MIC"], capabilities: NONE });
    expect(ok!.degraded).toBe(false);
    expect(poor!.degraded).toBe(true);
  });
});

/**
 * The bug a player found, made into a test.
 *
 * The deal walks the deck accumulating **par**; the tier windows in
 * `GAME_DESIGN.md` §5 are stated in **clock minutes**. Treating one as the
 * other stretched the whole curve by however much slower people are than par,
 * and the result was that a player who got through seven levels in their five
 * minutes was dealt 84% `annoying`, 16% `cursed`, and never once a `forbidden`
 * level. Most of the catalogue was unreachable by most of the people playing.
 *
 * These pin the property rather than the constant, so `PACE` can be replaced
 * with a measured number from `npm run playtest:report` without rewriting them
 * — they only fail if the escalation stops being reachable.
 */
describe("the curve is reachable in the time people actually have", () => {
  /* What a run looks like to someone who gets seven levels in. */
  const REACH = 7;

  function mixOverSeeds(reach: number) {
    const counts: Record<Tier, number> = { annoying: 0, cursed: 0, unhinged: 0, forbidden: 0 };
    let sawBeyondAnnoying = 0;
    for (let seed = 0; seed < 400; seed++) {
      const slice = deal(seed).slice(0, reach);
      for (const d of slice) counts[d.module.meta.tier]++;
      if (slice.some((d) => d.module.meta.tier !== "annoying")) sawBeyondAnnoying++;
    }
    return { counts, sawBeyondAnnoying };
  }

  it("does not spend a whole short run in the shallow end", () => {
    const { counts } = mixOverSeeds(REACH);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    /* The regression: `annoying` was 84% of a seven-level run. Anything past
       two thirds means the escalation has stopped happening again. */
    expect(counts.annoying / total).toBeLessThan(0.67);
    /* And the top half of the catalogue has to actually turn up. */
    expect((counts.unhinged + counts.forbidden) / total).toBeGreaterThan(0.08);
  });

  it("reaches every tier before the deck runs out", () => {
    const seen = new Set<Tier>();
    for (let seed = 0; seed < 200; seed++) {
      for (const d of deal(seed)) seen.add(d.module.meta.tier);
    }
    expect([...seen].sort()).toEqual(["annoying", "cursed", "forbidden", "unhinged"]);
  });

  it("still opens gently — the first level is never the deep end", () => {
    for (let seed = 0; seed < 400; seed++) {
      expect(deal(seed)[0]!.module.meta.tier).toBe("annoying");
    }
  });
});

/**
 * No level is orphaned.
 *
 * Levels are dealt through tier windows, family adjacency, permission budgets
 * and a coupled cap, and it is entirely possible to write a level that every
 * one of those quietly excludes — it ships, it is in the index, and no run ever
 * contains it. The e2e suite used to hunt one particular level through dealt
 * decks and skip when it could not find it, which is how a change to the deal
 * managed to switch off four tests without anybody noticing.
 *
 * This asks the question directly instead.
 */
describe("every level is actually reachable", () => {
  /* The real catalogue, not this file's fixtures — the question is about
     levels that actually shipped. */
  const caps: CapabilitySet = new Set(["pointer", "keyboard", "touch", "audioOut"]);

  it("deals each unlocked level to somebody within a few hundred seeds", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300 && seen.size < SHIPPED.length; seed++) {
      for (const d of dealDeck({ seed, registry: SHIPPED, capabilities: caps })) {
        seen.add(d.module.meta.id);
      }
    }

    const orphaned = SHIPPED.filter((m) => !seen.has(m.meta.id) && !m.meta.unlock).map(
      (m) => `${m.meta.id} (${m.meta.tier}/${m.meta.family})`,
    );
    expect(orphaned, "these ship but no run ever deals them").toEqual([]);
  });
});
