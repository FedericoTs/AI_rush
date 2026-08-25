import { describe, expect, it } from "vitest";
import {
  comboFor, MAX_RUN_EVENTS, scoreLevel, scoreRun, validateRun,
  RUN_DURATION_MS, TIER_BASE, type DeckEntry, type RunEvent,
} from "./scoring";
import { META_BY_ID } from "@/levels/catalog";

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

  /*
   * A log too long to store is refused, not quietly shortened.
   *
   * The submit route used to `slice(0, 400)` before scoring, so a longer run
   * was neither rejected nor scored correctly: it was scored on its first 400
   * events and the player never got the points for anything after. The server
   * rescores from the log it is handed, so truncating the log truncates the
   * run — silently, at the last step, after five minutes of play.
   *
   * L13 made it reachable. A device held past the spill angle failed every
   * 320ms with no pause, so an uncorrected grip crossed 400 events in about
   * two minutes.
   */
  const long = (n: number): RunEvent[] =>
    Array.from({ length: n }, (_, i) =>
      i === 0
        ? { seq: 1, kind: "enter" as const, levelId: "L01", atMs: 0 }
        : { seq: i + 1, kind: "fail" as const, levelId: "L01", atMs: i * 10 },
    );

  it("accepts a run right up to the ceiling", () => {
    /* Set far above real play on purpose — the largest run recorded is 56
       events. A bound tuned to the data you happen to have is how you throw
       out somebody's real run later. */
    expect(validateRun(long(MAX_RUN_EVENTS), deck, 300_000)).toBeNull();
  });

  it("refuses one event past it", () => {
    expect(validateRun(long(MAX_RUN_EVENTS + 1), deck, 300_000)).toBe("too_many_events");
  });

  it("refuses a truncated log rather than scoring the prefix", () => {
    /* The composition the routes actually perform: bound the work, then
       validate. The slice keeps one event more than the ceiling precisely so
       that an overflow is still visible to this function. */
    const submitted = long(50_000).slice(0, MAX_RUN_EVENTS + 1);
    expect(validateRun(submitted, deck, 300_000)).toBe("too_many_events");
    /* And the thing that used to happen instead: a prefix that scores fine. */
    expect(validateRun(long(50_000).slice(0, 400), deck, 300_000)).toBeNull();
  });

  it("rejects a clock that ran long", () => {
    expect(validateRun(ok, deck, RUN_DURATION_MS + 60_000)).toBe("clock_overrun");
  });

  /*
   * This test used to assert that one solve nobody could have performed sank
   * the whole run. It was wrong, and it kept a real bug pinned in place: a
   * player who already knows a level genuinely does beat it in two clicks, and
   * a twelve-level run was published as a zero because of it. A single fast
   * solve is now accepted; see the incident tests at the bottom of this file.
   */
  it("tolerates one solve nobody could have performed", () => {
    const fast: RunEvent[] = [{ seq: 1, kind: "solve", levelId: "L01", atMs: 40, solveMs: 40 }];
    expect(validateRun(fast, deck, 1000)).toBeNull();
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

/**
 * The rule that cost a real run.
 *
 * A player solved twelve levels in three minutes and forty-nine seconds and it
 * was filed as a score of nought, because one of the twelve was solved in
 * under 300ms and the speed check rejected the whole log. These pin the shape
 * of the fix: one fast solve is skill, a log of nothing but fast solves is a
 * fabrication, and the difference between them is a pattern.
 */
describe("plausibility, after the zero-score incident", () => {
  const deck: DeckEntry[] = [
    { levelId: "A", tier: "annoying", parSeconds: 20 },
    { levelId: "B", tier: "cursed", parSeconds: 25 },
    { levelId: "C", tier: "unhinged", parSeconds: 40 },
    { levelId: "D", tier: "unhinged", parSeconds: 30 },
    { levelId: "E", tier: "forbidden", parSeconds: 20 },
  ];

  /** A run of solves, one per level, at the given solve times. */
  const log = (times: number[]): RunEvent[] => {
    const events: RunEvent[] = [];
    let at = 0;
    times.forEach((solveMs, i) => {
      const levelId = deck[i]!.levelId;
      events.push({ seq: events.length + 1, kind: "enter", levelId, atMs: at });
      at += solveMs;
      events.push({ seq: events.length + 1, kind: "solve", levelId, atMs: at, solveMs });
    });
    return events;
  };

  it("accepts a run where one level was beaten by someone who knew it", () => {
    const events = log([12_000, 9_000, 0, 21_000, 8_000]);
    expect(validateRun(events, deck, 50_000)).toBeNull();
  });

  it("scores that run rather than zeroing it", () => {
    const events = log([12_000, 9_000, 0, 21_000, 8_000]);
    const totals = scoreRun(events, deck);
    expect(totals.solved).toBe(5);
    expect(totals.score).toBeGreaterThan(1_000);
  });

  it("still throws out a log that is nothing but instant solves", () => {
    expect(validateRun(log([0, 0, 0, 0, 0]), deck, 4_000)).toBe("impossible_speed");
  });

  it("draws the line at a pattern, not a single data point", () => {
    /* Two fast solves is a good run. Three is not a run. */
    expect(validateRun(log([0, 50, 9_000, 21_000, 8_000]), deck, 40_000)).toBeNull();
    expect(validateRun(log([0, 50, 90, 21_000, 8_000]), deck, 40_000)).toBe("impossible_speed");
  });

  /* The other rejections are structural and must keep firing: they are what
     actually stands between the board and a forged log. */
  it("keeps rejecting the things that are genuinely impossible", () => {
    const ok = log([12_000, 9_000, 5_000, 21_000, 8_000]);
    expect(validateRun(ok, deck, 999_000)).toBe("clock_overrun");
    expect(validateRun([...ok, { seq: 1, kind: "fail", levelId: "A", atMs: 1 }], deck, 50_000))
      .toBe("event_integrity");
    expect(validateRun([{ seq: 1, kind: "enter", levelId: "NOPE", atMs: 0 }], deck, 1_000))
      .toBe("deck_mismatch");
  });

  /*
   * The actual log from the run that was lost, replayed. It is twelve solves,
   * one skip and three fails over 3:49, with a single 0ms solve on L27 — the
   * level whose honest solve really is two clicks once you know it.
   */
  it("accepts the exact run that was published as a zero", () => {
    const real: Array<[number, RunEvent["kind"], string, number, number?]> = [
      [1, "enter", "L01", 0], [2, "solve", "L01", 1004, 1004],
      [3, "enter", "L05", 1004], [4, "fail", "L05", 8003], [5, "solve", "L05", 51002, 49998],
      [6, "enter", "L02", 51002], [7, "solve", "L02", 64008, 13006],
      [8, "enter", "L42", 64008], [9, "solve", "L42", 80002, 15994],
      [10, "enter", "L04", 80002], [11, "fail", "L04", 84003], [12, "solve", "L04", 101002, 21000],
      [13, "enter", "L11", 101002], [14, "solve", "L11", 138003, 37001],
      [15, "enter", "L12", 138003], [16, "skip", "L12", 152047],
      [17, "enter", "L16", 152047], [18, "solve", "L16", 173002, 20955],
      [19, "enter", "L18", 173002], [20, "fail", "L18", 177003], [21, "solve", "L18", 190003, 17001],
      [22, "enter", "L27", 190003], [23, "solve", "L27", 190003, 0],
      [24, "enter", "L22", 190003], [25, "solve", "L22", 211004, 21001],
      [26, "enter", "L28", 211004], [27, "solve", "L28", 214005, 3001],
      [28, "enter", "L37", 214005], [29, "solve", "L37", 229005, 15000],
    ];
    const events: RunEvent[] = real.map(([seq, kind, levelId, atMs, solveMs]) => ({
      seq, kind, levelId, atMs, ...(solveMs === undefined ? {} : { solveMs }),
    }));
    const realDeck: DeckEntry[] = [...new Set(events.map((e) => e.levelId))].map((id) => {
      const m = META_BY_ID.get(id);
      if (!m) throw new Error(`level ${id} left the catalogue`);
      return { levelId: m.id, tier: m.tier, parSeconds: m.parSeconds };
    });

    expect(validateRun(events, realDeck, 229_005)).toBeNull();

    const totals = scoreRun(events, realDeck);
    expect(totals.solved).toBe(12);
    expect(totals.skipped).toBe(1);
    expect(totals.score).toBeGreaterThan(5_000);
    /* And it stays under the ceiling the database enforces independently. */
    expect(totals.score).toBeLessThanOrEqual(totals.solved * 4800);
  });
});
