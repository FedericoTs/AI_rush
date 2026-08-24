import { describe, expect, it, vi } from "vitest";
import { GameClock, formatClock } from "./clock";

/** A clock with no rAF and a hand-cranked time source — no timers, no flake. */
function testClock(durationMs = 300_000) {
  let t = 0;
  const clock = new GameClock({ durationMs, now: () => t, schedule: null });
  return { clock, tick: (ms: number) => (t += ms) };
}

describe("GameClock", () => {
  it("counts down from the full duration", () => {
    const { clock, tick } = testClock();
    expect(clock.remainingMs).toBe(300_000);
    clock.start();
    tick(30_000);
    expect(clock.remainingMs).toBe(270_000);
  });

  it("charges a skip ten seconds without touching wall time", () => {
    const { clock, tick } = testClock();
    clock.start();
    tick(10_000);
    clock.penalize(10_000);
    expect(clock.remainingMs).toBe(280_000);
  });

  it("fires expire exactly once when it runs out", () => {
    const { clock, tick } = testClock(1000);
    const onExpire = vi.fn();
    clock.onExpire(onExpire);
    clock.start();
    tick(1500);
    clock.penalize(0); // force an emit
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(clock.expired).toBe(true);
  });

  it("never reports negative time remaining", () => {
    const { clock, tick } = testClock(1000);
    clock.start();
    tick(99_999);
    expect(clock.remainingMs).toBe(0);
  });

  it("supports manual stepping for headless runs", () => {
    const { clock } = testClock();
    clock.advance(120_000);
    expect(clock.remainingMs).toBe(180_000);
  });

  it("stops accumulating once stopped", () => {
    const { clock, tick } = testClock();
    clock.start();
    tick(5_000);
    clock.stop();
    tick(60_000);
    expect(clock.remainingMs).toBe(295_000);
  });

  it("notifies tick subscribers and lets them unsubscribe", () => {
    const { clock } = testClock();
    const seen: number[] = [];
    const off = clock.onTick((ms) => seen.push(ms));
    clock.advance(1000);
    off();
    clock.advance(1000);
    expect(seen).toEqual([299_000]);
  });
});

describe("formatClock", () => {
  it("renders m:ss", () => {
    expect(formatClock(300_000)).toBe("5:00");
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(9_000)).toBe("0:09");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-500)).toBe("0:00");
  });
});
