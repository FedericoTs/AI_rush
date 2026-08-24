import { describe, expect, it } from "vitest";
import { decodeSeed, encodeSeed, hashString, mulberry32, streamFor } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = Array.from({ length: 50 }, mulberry32(12345));
    const b = Array.from({ length: 50 }, mulberry32(12345));
    expect(a).toEqual(b);
  });

  it("diverges for different seeds", () => {
    const a = Array.from({ length: 20 }, mulberry32(1));
    const b = Array.from({ length: 20 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it("stays in [0, 1)", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 5000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("distributes int() across the whole range", () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.int(10));
    expect(seen.size).toBe(10);
    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(9);
  });

  it("shuffles without mutating and without losing elements", () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = mulberry32(4).shuffle(source);
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out.slice().sort((a, b) => a - b)).toEqual(source);
  });

  it("throws rather than returning undefined when picking from nothing", () => {
    expect(() => mulberry32(1).pick([])).toThrow(RangeError);
  });
});

describe("streamFor", () => {
  it("gives a level the same numbers regardless of deck position", () => {
    const a = Array.from({ length: 10 }, streamFor(777, "L37"));
    const b = Array.from({ length: 10 }, streamFor(777, "L37"));
    expect(a).toEqual(b);
  });

  it("gives different levels different streams from one run seed", () => {
    const a = Array.from({ length: 10 }, streamFor(777, "L11"));
    const b = Array.from({ length: 10 }, streamFor(777, "L12"));
    expect(a).not.toEqual(b);
  });
});

describe("hashString", () => {
  it("is stable and unsigned", () => {
    expect(hashString("L01")).toBe(hashString("L01"));
    expect(hashString("L01")).toBeGreaterThanOrEqual(0);
    expect(hashString("L01")).not.toBe(hashString("L02"));
  });
});

describe("seed links", () => {
  it("round-trips seed and capability marks", () => {
    const text = encodeSeed(0x8f2a1c, ["M", "A", "C"]);
    expect(text).toBe("8F2A1C-MAC");
    expect(decodeSeed(text)).toEqual({ seed: 0x8f2a1c, marks: ["M", "A", "C"] });
  });

  it("orders marks canonically so one run has one link", () => {
    expect(encodeSeed(1, ["C", "M"])).toBe(encodeSeed(1, ["M", "C"]));
  });

  it("omits the suffix when nothing was available", () => {
    expect(encodeSeed(0xabc, [])).toBe("000ABC");
    expect(decodeSeed("000ABC")).toEqual({ seed: 0xabc, marks: [] });
  });

  it("rejects junk instead of guessing", () => {
    expect(decodeSeed("nope")).toBeNull();
    expect(decodeSeed("8F2A1C-XYZ")).toBeNull();
  });
});
