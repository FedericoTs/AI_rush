import { describe, expect, it } from "vitest";
import { toLiveStats } from "./liveStats";

/**
 * The numbers on the front page, read across a version boundary.
 *
 * The app and the database are deployed by different mechanisms minutes
 * apart, so for a short window one is older than the other. A missing key
 * used to mean `undefined.toLocaleString()` — a blank landing page, caused by
 * a counter.
 */
describe("reading live_stats", () => {
  it("takes the numbers when they are all there", () => {
    expect(toLiveStats({ playingNow: 2, runs: 438, players: 17, topScore: 9100 }))
      .toEqual({ playingNow: 2, runs: 438, players: 17, topScore: 9100 });
  });

  it("still reads a database that has not been migrated yet", () => {
    /* The old key held a rolling day of finished runs. Accepting it costs
       nothing and keeps the page alive through a deploy. */
    expect(toLiveStats({ playingNow: 1, runsToday: 9, players: 3 }).runs).toBe(9);
  });

  it("prefers the new key when both are present", () => {
    expect(toLiveStats({ runs: 438, runsToday: 9 }).runs).toBe(438);
  });

  it("gives a zero rather than a crash for anything missing or absurd", () => {
    for (const raw of [null, undefined, {}, "nope", { runs: null }, { runs: "many" }, { runs: NaN }]) {
      const s = toLiveStats(raw);
      expect(Number.isFinite(s.runs)).toBe(true);
      expect(Number.isFinite(s.playingNow)).toBe(true);
      /* The actual failure: every one of these must survive being rendered. */
      expect(() => s.runs.toLocaleString()).not.toThrow();
    }
  });
});
