import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { CouplingGraph, type Coupling, type ControlSpec } from "./graph";
import { proveSolvable, scrambleFrom, solveOrder } from "./solver";

/** L37 — four dials, each turning every dial to its right. Solve: left to right. */
function gearTrain() {
  const controls: ControlSpec[] = [0, 1, 2, 3].map((i) => ({
    id: `d${i}`, min: 0, max: 9, wrap: true,
  }));
  const couplings: Coupling[] = [
    { from: "d0", to: "d1", kind: "propagate", ratio: 1 },
    { from: "d1", to: "d2", kind: "propagate", ratio: 1 },
    { from: "d2", to: "d3", kind: "propagate", ratio: 1 },
  ];
  return new CouplingGraph(controls, couplings);
}

/** L12 — ten faders, each dragging its LEFT neighbour by half. Solve: right to left. */
function faderBank() {
  const controls: ControlSpec[] = Array.from({ length: 10 }, (_, i) => ({
    id: `f${i}`, min: 0, max: 9,
  }));
  const couplings: Coupling[] = Array.from({ length: 9 }, (_, i) => ({
    from: `f${i + 1}`, to: `f${i}`, kind: "propagate" as const, ratio: 0.5,
  }));
  return new CouplingGraph(controls, couplings);
}

describe("the gear train (L37)", () => {
  const g = gearTrain();

  it("turns every dial to the right of the one you touched", () => {
    const s = g.apply(g.initial(0), "d0", 3);
    expect([s.d0, s.d1, s.d2, s.d3]).toEqual([3, 3, 3, 3]);
  });

  it("leaves dials to the left alone", () => {
    const s = g.apply(g.initial(0), "d2", 4);
    expect([s.d0, s.d1, s.d2, s.d3]).toEqual([0, 0, 4, 4]);
  });

  it("wraps rather than clamping, because dials are dials", () => {
    const s = g.apply(g.initial(8), "d3", 5);
    expect(s.d3).toBe(3);
  });

  it("solves strictly left to right", () => {
    expect(solveOrder(g)).toEqual(["d0", "d1", "d2", "d3"]);
  });

  it("reaches the target from any start, in exactly one move per dial", () => {
    const target = { d0: 4, d1: 7, d2: 2, d3: 9 };
    const rng = mulberry32(1234);
    for (let i = 0; i < 2000; i++) {
      const start = { d0: rng.int(10), d1: rng.int(10), d2: rng.int(10), d3: rng.int(10) };
      const proof = proveSolvable(g, start, target);
      expect(proof.solvable).toBe(true);
      expect(proof.plan!.moves.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("the fader bank (L12)", () => {
  const g = faderBank();

  it("drags the left neighbour by half the delta", () => {
    const s = g.apply(g.initial(0), "f5", 4);
    expect(s.f5).toBe(4);
    expect(s.f4).toBe(2);
    expect(s.f3).toBe(1);
  });

  it("never disturbs a fader to the right", () => {
    const s = g.apply(g.initial(3), "f2", 6);
    expect(s.f3).toBe(3);
    expect(s.f9).toBe(3);
  });

  it("clamps rather than wrapping, because faders have ends", () => {
    const s = g.apply(g.initial(8), "f9", 5);
    expect(s.f9).toBe(9);
  });

  it("solves strictly right to left — the mirror of the gear train", () => {
    expect(solveOrder(g)).toEqual(["f9", "f8", "f7", "f6", "f5", "f4", "f3", "f2", "f1", "f0"]);
  });
});

describe("solvability, which is not optional", () => {
  it("refuses a cyclic graph, because no ordering makes its moves final", () => {
    const cyclic = new CouplingGraph(
      [
        { id: "a", min: 0, max: 9 },
        { id: "b", min: 0, max: 9 },
      ],
      [
        { from: "a", to: "b", kind: "propagate", ratio: 1 },
        { from: "b", to: "a", kind: "propagate", ratio: 1 },
      ],
    );
    expect(solveOrder(cyclic)).toBeNull();
    const proof = proveSolvable(cyclic, { a: 0, b: 0 }, { a: 3, b: 5 });
    expect(proof.solvable).toBe(false);
    expect(proof.reason).toMatch(/cycle/);
  });

  /* The CI gate. An unsolvable seed turns the joke into a bug report. */
  it("proves 10,000 seeds reachable on both shipped coupled levels", () => {
    const cases = [
      { g: gearTrain(), target: { d0: 4, d1: 7, d2: 2, d3: 9 } },
      { g: faderBank(), target: Object.fromEntries([4, 1, 5, 5, 5, 5, 0, 1, 9, 2].map((v, i) => [`f${i}`, v])) },
    ];
    for (const { g, target } of cases) {
      for (let seed = 0; seed < 5000; seed++) {
        const rng = mulberry32(seed);
        const start = scrambleFrom(g, target, 6, rng);
        expect(proveSolvable(g, start, target).solvable).toBe(true);
      }
    }
  });

  it("scrambles by walking legal moves backwards, never by shuffling", () => {
    const g = gearTrain();
    const target = { d0: 4, d1: 7, d2: 2, d3: 9 };
    const start = scrambleFrom(g, target, 8, mulberry32(42));
    for (const id of ["d0", "d1", "d2", "d3"]) {
      expect(start[id]).toBeGreaterThanOrEqual(0);
      expect(start[id]).toBeLessThanOrEqual(9);
    }
    expect(proveSolvable(g, start, target).solvable).toBe(true);
  });
});
