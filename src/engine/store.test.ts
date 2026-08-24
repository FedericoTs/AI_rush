import { beforeEach, describe, expect, it } from "vitest";
import { useRun } from "./store";
import { RUN_DURATION_MS, scoreRun, validateRun, type DeckEntry } from "./scoring";
import { PRACTICE_DURATION_MS } from "./deck";
import { REGISTRY } from "@/levels/registry";
import type { InputCapability } from "./types";

const CAPS = new Set<InputCapability>(["pointer", "keyboard", "touch", "audioOut"]);

const start = (seed = 99, mercy = false) =>
  useRun.getState().startRun({ seed, registry: REGISTRY, capabilities: CAPS, mercy });

const deckEntries = (): DeckEntry[] =>
  useRun.getState().deck.map((d) => ({
    levelId: d.module.meta.id,
    tier: d.module.meta.tier,
    parSeconds: d.module.meta.parSeconds,
  }));

/** Advance the clock the way the real one does — the store never moves time. */
const elapse = (ms: number) => {
  const s = useRun.getState();
  s.setRemaining(s.remainingMs - ms);
};

describe("the run", () => {
  beforeEach(() => useRun.getState().reset());

  it("deals a deck and enters the first level", () => {
    start();
    const s = useRun.getState();
    expect(s.phase).toBe("playing");
    expect(s.deck.length).toBeGreaterThan(0);
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({ seq: 1, kind: "enter" });
  });

  it("builds combo across consecutive solves", () => {
    start();
    for (let i = 0; i < 3; i++) {
      elapse(5_000);
      useRun.getState().solve();
    }
    const s = useRun.getState();
    expect(s.solved).toBe(3);
    expect(s.bestCombo).toBe(1.5);
    expect(s.breakdown.map((b) => b.combo)).toEqual([1, 1.2, 1.5]);
  });

  it("charges a fail the first-try bonus and nothing more", () => {
    start();
    elapse(3_000);
    useRun.getState().fail("nope");
    elapse(3_000);
    useRun.getState().solve();

    const first = useRun.getState().breakdown[0]!;
    expect(first.fails).toBe(1);

    useRun.getState().reset();
    start();
    elapse(6_000);
    useRun.getState().solve();
    const clean = useRun.getState().breakdown[0]!;

    expect(clean.points - first.points).toBe(100);
  });

  it("resets the streak on a skip and records it as unscored", () => {
    start();
    elapse(4_000);
    useRun.getState().solve();
    useRun.getState().skip();

    const s = useRun.getState();
    expect(s.streak).toBe(0);
    expect(s.skipped).toBe(1);
    expect(s.breakdown[1]).toMatchObject({ skipped: true, points: 0 });
  });

  it("does not move the clock itself — the GameClock owns time", () => {
    start();
    const before = useRun.getState().remainingMs;
    useRun.getState().skip();
    expect(useRun.getState().remainingMs).toBe(before);
  });

  it("ends when the clock expires, naming the level it caught you on", () => {
    start();
    const title = useRun.getState().deck[0]!.module.meta.title;
    useRun.getState().setRemaining(0);
    const s = useRun.getState();
    expect(s.phase).toBe("tally");
    expect(s.killedBy).toBe(title);
  });

  it("ends with no cause of death when the deck is cleared", () => {
    start();
    const size = useRun.getState().deck.length;
    for (let i = 0; i < size; i++) {
      elapse(1_000);
      useRun.getState().solve();
    }
    const s = useRun.getState();
    expect(s.phase).toBe("tally");
    expect(s.killedBy).toBeNull();
  });

  it("is reproducible from a seed", () => {
    start(31337);
    const a = useRun.getState().deck.map((d) => d.module.meta.id);
    useRun.getState().reset();
    start(31337);
    expect(useRun.getState().deck.map((d) => d.module.meta.id)).toEqual(a);
  });
});

/**
 * The one that matters. The client's number is advisory; the server recomputes
 * from the event log. If these ever disagree, every leaderboard entry is wrong.
 */
describe("client score and server recompute", () => {
  beforeEach(() => useRun.getState().reset());

  it("agree over a mixed run of solves, fails and skips", () => {
    start(2024);
    const script: Array<"solve" | "fail" | "skip"> = [
      "solve", "fail", "solve", "skip", "solve", "solve", "fail", "fail", "solve", "skip", "solve",
    ];
    for (const action of script) {
      if (useRun.getState().phase !== "playing") break;
      elapse(4_000);
      useRun.getState()[action]();
    }

    const s = useRun.getState();
    const recomputed = scoreRun(s.events, deckEntries());
    expect(recomputed.score).toBe(s.score);
    expect(recomputed.solved).toBe(s.solved);
    expect(recomputed.skipped).toBe(s.skipped);
    expect(recomputed.bestCombo).toBe(s.bestCombo);
  });

  it("agree across many seeds and action orders", () => {
    for (let seed = 0; seed < 40; seed++) {
      useRun.getState().reset();
      start(seed);
      for (let step = 0; step < 12; step++) {
        if (useRun.getState().phase !== "playing") break;
        elapse(2_500);
        const roll = (seed * 7 + step * 13) % 10;
        if (roll < 6) useRun.getState().solve();
        else if (roll < 8) useRun.getState().fail();
        else useRun.getState().skip();
      }
      const s = useRun.getState();
      expect(scoreRun(s.events, deckEntries()).score).toBe(s.score);
    }
  });

  it("produces an event log the server accepts as honest", () => {
    start(7);
    for (let i = 0; i < 4; i++) {
      elapse(6_000);
      useRun.getState().solve();
    }
    const s = useRun.getState();
    expect(validateRun(s.events, deckEntries(), s.elapsedMs)).toBeNull();
  });

  /* The clock is a float and the database column is an integer. A fractional
     atMs loses the entire run to a cast error, silently, at the last step. */
  it("emits whole milliseconds, never fractions", () => {
    start(11);
    for (let i = 0; i < 5; i++) {
      const s = useRun.getState();
      s.setRemaining(s.remainingMs - 3333.7777);
      if (i % 2 === 0) useRun.getState().solve();
      else useRun.getState().fail();
    }
    for (const ev of useRun.getState().events) {
      expect(Number.isInteger(ev.atMs)).toBe(true);
      if (ev.solveMs !== undefined) expect(Number.isInteger(ev.solveMs)).toBe(true);
    }
    for (const row of useRun.getState().breakdown) {
      expect(Number.isInteger(row.solveMs)).toBe(true);
    }
  });

  it("numbers events consecutively from one, with no gaps", () => {
    start(5);
    elapse(3_000);
    useRun.getState().fail();
    useRun.getState().solve();
    useRun.getState().skip();
    const seqs = useRun.getState().events.map((e) => e.seq);
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
  });
});

/**
 * Practice.
 *
 * The store's job here is narrow but load-bearing: the deck is the one asked
 * for, and elapsed time is measured against *this* run's clock rather than the
 * five-minute constant. Getting the second one wrong sends every solveMs
 * negative, which is invisible until a tally reads -4.2s.
 */
describe("a practice run", () => {
  beforeEach(() => useRun.getState().reset());

  const practice = (ids: string[], durationMs = PRACTICE_DURATION_MS) =>
    useRun.getState().startRun({
      seed: 1, registry: REGISTRY, capabilities: CAPS, only: ids, durationMs,
    });

  it("plays exactly the levels named, in order", () => {
    practice(["L37", "L01"]);
    expect(useRun.getState().deck.map((d) => d.module.meta.id)).toEqual(["L37", "L01"]);
    expect(useRun.getState().practice).toBe(true);
  });

  it("is flagged as practice so nothing downstream tries to file it", () => {
    start();
    expect(useRun.getState().practice).toBe(false);
    practice(["L01"]);
    expect(useRun.getState().practice).toBe(true);
  });

  it("measures elapsed against its own clock, not the five-minute one", () => {
    practice(["L01"]);
    expect(useRun.getState().remainingMs).toBe(PRACTICE_DURATION_MS);

    useRun.getState().setRemaining(PRACTICE_DURATION_MS - 7_000);
    expect(useRun.getState().elapsedMs).toBe(7_000);

    useRun.getState().solve();
    expect(useRun.getState().breakdown[0]!.solveMs).toBe(7_000);
  });

  it("ends at the tally once the picked levels are done", () => {
    practice(["L01", "L02"]);
    useRun.getState().setRemaining(PRACTICE_DURATION_MS - 2_000);
    useRun.getState().solve();
    useRun.getState().solve();
    expect(useRun.getState().phase).toBe("tally");
    expect(useRun.getState().killedBy).toBeNull();
  });

  it("goes back to a full five minutes on the next ordinary run", () => {
    practice(["L01"]);
    useRun.getState().reset();
    start();
    expect(useRun.getState().durationMs).toBe(RUN_DURATION_MS);
    expect(useRun.getState().practice).toBe(false);
  });
});
