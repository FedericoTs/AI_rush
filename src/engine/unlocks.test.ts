import { describe, expect, it } from "vitest";
import {
  MAX_CREDITS, NOTHING_UNLOCKED, isUnlocked, nextShareUnlock,
  parseUnlockParams, unlockParams,
} from "./unlocks";
import { dealDeck } from "./deck";
import { CATALOG } from "@/levels/catalog";
import { REGISTRY } from "@/levels/registry";
import type { InputCapability, LevelMeta } from "./types";

const CAPS = new Set<InputCapability>(["pointer", "keyboard", "touch", "audioOut"]);

const meta = (unlock?: LevelMeta["unlock"]): LevelMeta => ({
  id: "LXX", slug: "x", title: "X", parodies: "a thing",
  tier: "unhinged", family: "meta", parSeconds: 30,
  requires: ["pointer"], incompatibleModifiers: [], unlock,
});

describe("what counts as unlocked", () => {
  it("leaves ordinary levels open", () => {
    expect(isUnlocked(meta(), NOTHING_UNLOCKED)).toBe(true);
  });

  it("opens a share level at its threshold and not before", () => {
    const m = meta({ kind: "share", credits: 3 });
    expect(isUnlocked(m, { credits: 2, secret: false })).toBe(false);
    expect(isUnlocked(m, { credits: 3, secret: false })).toBe(true);
    expect(isUnlocked(m, { credits: 9, secret: false })).toBe(true);
  });

  it("never opens the secret through sharing, however much you share", () => {
    const m = meta({ kind: "secret" });
    expect(isUnlocked(m, { credits: MAX_CREDITS, secret: false })).toBe(false);
    expect(isUnlocked(m, { credits: 0, secret: true })).toBe(true);
  });
});

describe("the URL form", () => {
  it("reads nothing as nothing", () => {
    expect(parseUnlockParams(undefined, undefined)).toEqual({ credits: 0, secret: false });
  });

  it("round-trips a state through a link", () => {
    const state = { credits: 4, secret: true };
    const q = unlockParams(state);
    expect(parseUnlockParams(q.u, q.x)).toEqual(state);
  });

  it("omits what is already the default, so a plain link stays plain", () => {
    expect(unlockParams(NOTHING_UNLOCKED)).toEqual({});
  });

  /* Not signed, and it does not need to be — an unlocked level is worth what
     its tier is worth, so there is nothing to gain by editing this. What it
     does have to do is never throw. */
  it("survives anything a URL can contain", () => {
    for (const bad of ["", "-1", "abc", "1e999", "999999", "NaN", "٣"]) {
      const out = parseUnlockParams(bad, bad);
      expect(out.credits).toBeGreaterThanOrEqual(0);
      expect(out.credits).toBeLessThanOrEqual(MAX_CREDITS);
    }
  });
});

describe("what sharing opens next", () => {
  it("names the cheapest thing still locked", () => {
    const next = nextShareUnlock(CATALOG, NOTHING_UNLOCKED);
    expect(next).not.toBeNull();
    expect(next!.credits).toBe(1);
  });

  it("moves up the ladder as credits arrive", () => {
    const after = nextShareUnlock(CATALOG, { credits: 1, secret: false });
    expect(after!.credits).toBeGreaterThan(1);
  });

  it("returns null once there is nothing left to open", () => {
    expect(nextShareUnlock(CATALOG, { credits: MAX_CREDITS, secret: false })).toBeNull();
  });

  /* A ladder with two rungs at the same height is a ladder with one rung. */
  it("has distinct thresholds, so each unlock is a separate moment", () => {
    const gated = CATALOG.filter((m) => m.unlock?.kind === "share")
      .map((m) => (m.unlock as { credits: number }).credits);
    expect(new Set(gated).size).toBe(gated.length);
    expect(gated.length).toBeGreaterThan(0);
  });
});

describe("locked levels and the deck", () => {
  const ids = (unlocks: Parameters<typeof dealDeck>[0]["unlocks"]) =>
    new Set(
      Array.from({ length: 120 }, (_, seed) =>
        dealDeck({ seed, registry: REGISTRY, capabilities: CAPS, unlocks }).map(
          (d) => d.module.meta.id,
        ),
      ).flat(),
    );

  it("never deals a locked level to someone who has not opened it", () => {
    const dealt = ids(NOTHING_UNLOCKED);
    for (const m of CATALOG) {
      if (m.unlock) expect(dealt.has(m.id), `${m.id} leaked into a base deck`).toBe(false);
    }
  });

  it("deals them once they are open", () => {
    const dealt = ids({ credits: MAX_CREDITS, secret: true });
    for (const m of CATALOG) {
      if (m.unlock?.kind === "share") expect(dealt.has(m.id), m.id).toBe(true);
    }
  });

  /*
   * The property the whole feature hangs on.
   *
   * A challenge link promises "same seed, same levels, same order". If unlock
   * state did not travel with it, two people opening one link would be dealt
   * different decks and the head-to-head at the end would be a lie.
   */
  it("reproduces a deck exactly from seed plus unlock state", () => {
    for (const unlocks of [NOTHING_UNLOCKED, { credits: 1, secret: false }, { credits: 3, secret: true }]) {
      for (let seed = 0; seed < 60; seed++) {
        const a = dealDeck({ seed, registry: REGISTRY, capabilities: CAPS, unlocks });
        const b = dealDeck({ seed, registry: REGISTRY, capabilities: CAPS, unlocks });
        expect(a.map((d) => d.module.meta.id)).toEqual(b.map((d) => d.module.meta.id));
      }
    }
  });

  it("still deals a full deck with nothing unlocked, which is most players", () => {
    for (let seed = 0; seed < 80; seed++) {
      const deck = dealDeck({ seed, registry: REGISTRY, capabilities: CAPS });
      expect(deck.length).toBe(14);
      expect(new Set(deck.map((d) => d.module.meta.id)).size).toBe(deck.length);
    }
  });

  /*
   * Sharing must never be pay-to-win. Unlocked levels are worth what their
   * tier is worth, which is what makes the whole system safe to leave
   * unsigned: there is nothing to gain by forging one.
   */
  it("gates nothing that would be worth more than what is already free", () => {
    const freeTiers = new Set(CATALOG.filter((m) => !m.unlock).map((m) => m.tier));
    for (const m of CATALOG.filter((m) => m.unlock)) {
      expect(freeTiers.has(m.tier), `${m.id} is the only ${m.tier} level`).toBe(true);
    }
  });
});
