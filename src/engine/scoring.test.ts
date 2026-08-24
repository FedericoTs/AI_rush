import { describe, expect, it } from "vitest";
import {
  comboFor, scoreLevel, scoreRun, validateRun,
  RUN_DURATION_MS, TIER_BASE, type DeckEntry, type RunEvent,
} from "./scoring";

describe("comboFor", () => {
  it("walks the ladder at 1/2/3/5/8 solves", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 20].map(comboFor)).toEqual([
      1, 1, 1.2, 1.5, 1.5, 2, 2, 2, 3, 3,
    ]);
  });
});

describe("scoreLevel", () => {
  it("pays base plus a first-try bonus at par", () => {
    const s = scoreLevel({ tier: "cursed", parSeconds: 25, solveMs: 25_000, fails: 0, combo: 1 });
    expect(s.base).toBe(250);
    expect(s.speed).toBe(0);
    expect(s.firstTry).toBe(100);
    expect(s.total).toBe(350);
  });

  it("caps the speed bonus at half of base", () => {
    const s = scoreLevel({ tier: "cursed", parSeconds: 25, solveMs: 0, fails: 0, combo: 1 });
    expect(s.speed).toBe(125);
  });

  it("gives no speed bonus past par, and never a negative one", () => {
    const s = scoreLevel({ tier: "annoying", parSeconds: 10, solveMs: 60_000, fails: 3, combo: 1 });
    expect(s.speed).toBe(0);
    expect(s.total).toBe(100);
  });

  it("costs the first-try bonus on a fail but nothing else", () => {
    const clean = scoreLevel({ tier: "cursed", parSeconds: 25, solveMs: 10_000, fails: 0, combo: 1 });
    const messy = scoreLevel({ tier: "cursed", parSeconds: 25, solveMs: 10_000, fails: 2, combo: 1 });
    expect(clean.total - messy.total).toBe(100);
  });

  it("multiplies the whole level by combo", () => {
    const one = scoreLevel({ tier: "unhinged", parSeconds: 30, solveMs: 30_000, fails: 0, combo: 1 });
    const three = scoreLevel({ tier: "unhinged", parSeconds: 30, solveMs: 30_000, fails: 0, combo: 3 });
    expect(three.total).toBe(one.total * 3);
  });

  it("prices the Honest Level like the forbidden level it is", () => {
    expect(TIER_BASE.forbidden).toBe(1000);
  });
});

describe("scoreRun", () => {
  const deck: DeckEntry[] = [
    { levelId: "L01", tier: "annoying", parSeconds: 10 },
    { levelId: "L02", tier: "annoying", parSeconds: 20 },
    { levelId: "L12", tier: "cursed", parSeconds: 25 },
  ];

  it("builds the streak across consecutive solves", () => {
    const events: RunEvent[] = [
      { seq: 1, kind: "enter", levelId: "L01", atMs: 0 },
      { seq: 2, kind: "solve", levelId: "L01", atMs: 5_000, solveMs: 5_000 },
      { seq: 3, kind: "enter", levelId: "L02", atMs: 5_000 },
      { seq: 4, kind: "solve", levelId: "L02", atMs: 15_000, solveMs: 10_000 },
      { seq: 5, kind: "enter", levelId: "L12", atMs: 15_000 },
      { seq: 6, kind: "solve", levelId: "L12", atMs: 30_000, solveMs: 15_000 },
    ];
    const r = scoreRun(events, deck);
    expect(r.solved).toBe(3);
    expect(r.bestCombo).toBe(1.5);
    expect(r.perLevel.map((p) => p.combo)).toEqual([1, 1.2, 1.5]);
  });

  it("breaks the streak on a skip", () => {
    const events: RunEvent[] = [
      { seq: 1, kind: "enter", levelId: "L01", atMs: 0 },
      { seq: 2, kind: "solve", levelId: "L01", atMs: 5_000, solveMs: 5_000 },
      { seq: 3, kind: "enter", levelId: "L02", atMs: 5_000 },
      { seq: 4, kind: "skip", levelId: "L02", atMs: 8_000 },
      { seq: 5, kind: "enter", levelId: "L12", atMs: 8_000 },
      { seq: 6, kind: "solve", levelId: "L12", atMs: 20_000, solveMs: 12_000 },
    ];
    const r = scoreRun(events, deck);
    expect(r.skipped).toBe(1);
    expect(r.bestCombo).toBe(1);
    expect(r.perLevel.every((p) => p.combo === 1)).toBe(true);
  });

  it("charges fails to the level they happened on, not the next one", () => {
    const events: RunEvent[] = [
      { seq: 1, kind: "enter", levelId: "L01", atMs: 0 },
      { seq: 2, kind: "fail", levelId: "L01", atMs: 2_000 },
      { seq: 3, kind: "solve", levelId: "L01", atMs: 6_000, solveMs: 6_000 },
      { seq: 4, kind: "enter", levelId: "L02", atMs: 6_000 },
      { seq: 5, kind: "solve", levelId: "L02", atMs: 12_000, solveMs: 6_000 },
    ];
    const r = scoreRun(events, deck);
    const [first, second] = r.perLevel;
    expect(first!.points).toBeLessThan(second!.points); // no first-try bonus on L01
  });

  it("ignores whatever the client claimed and reads only the log", () => {
    expect(scoreRun([], deck).score).toBe(0);
  });
});

describe("validateRun", () => {
  const deck: DeckEntry[] = [
    { levelId: "L01", tier: "annoying", parSeconds: 10 },
    { levelId: "L02", tier: "annoying", parSeconds: 20 },
  ];
  const ok: RunEvent[] = [
    { seq: 1, kind: "enter", levelId: "L01", atMs: 0 },
    { seq: 2, kind: "solve", levelId: "L01", atMs: 5_000, solveMs: 5_000 },
  ];

  it("passes an honest run", () => {
    expect(validateRun(ok, deck, 300_000)).toBeNull();
  });

  it("rejects a clock that ran long", () => {
    expect(validateRun(ok, deck, RUN_DURATION_MS + 60_000)).toBe("clock_overrun");
  });

  it("rejects a solve nobody could have performed", () => {
    const fast: RunEvent[] = [{ seq: 1, kind: "solve", levelId: "L01", atMs: 40, solveMs: 40 }];
    expect(validateRun(fast, deck, 1000)).toBe("impossible_speed");
  });

  it("rejects events for levels that were never dealt", () => {
    const off: RunEvent[] = [{ seq: 1, kind: "solve", levelId: "L99", atMs: 9_000, solveMs: 9_000 }];
    expect(validateRun(off, deck, 10_000)).toBe("deck_mismatch");
  });

  it("rejects duplicate sequence numbers and gaps", () => {
    const dupe: RunEvent[] = [
      { seq: 1, kind: "enter", levelId: "L01", atMs: 0 },
      { seq: 1, kind: "enter", levelId: "L02", atMs: 1 },
    ];
    expect(validateRun(dupe, deck, 1000)).toBe("event_integrity");

    const gap: RunEvent[] = [
      { seq: 1, kind: "enter", levelId: "L01", atMs: 0 },
      { seq: 3, kind: "enter", levelId: "L02", atMs: 1 },
    ];
    expect(validateRun(gap, deck, 1000)).toBe("event_integrity");
  });

  it("rejects solving the same level twice", () => {
    const twice: RunEvent[] = [
      { seq: 1, kind: "solve", levelId: "L01", atMs: 5_000, solveMs: 5_000 },
      { seq: 2, kind: "solve", levelId: "L01", atMs: 9_000, solveMs: 4_000 },
    ];
    expect(validateRun(twice, deck, 10_000)).toBe("event_integrity");
  });
});
