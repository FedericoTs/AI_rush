import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { CouplingGraph, type Coupling, type ControlSpec, type ControlState } from "./graph";
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

/**
 * The two edge kinds Phase 5 needed, and the ordering claim each makes.
 */
describe("redistribute", () => {
  /* Three sliders that sum to a constant — L44. Declared in both directions
     because every slider takes from every other one. */
  const ids = ["b", "c", "s"];
  const graph = new CouplingGraph(
    ids.map((id) => ({ id, min: 0, max: 100 })),
    ids.flatMap((from) =>
      ids.filter((to) => to !== from).map((to) => ({ from, to, kind: "redistribute" as const })),
    ),
  );

  const sum = (s: ControlState) => ids.reduce((n, id) => n + s[id]!, 0);

  it("holds the total constant, which is the entire mechanic", () => {
    let state: ControlState = { b: 50, c: 50, s: 50 };
    for (const [id, delta] of [["b", 20], ["s", -13], ["c", 7], ["b", -31]] as const) {
      state = graph.apply(state, id, delta);
      expect(sum(state), `after ${id} ${delta}`).toBe(150);
    }
  });

  it("takes proportionally, so a big value gives up more than a small one", () => {
    const next = graph.apply({ b: 10, c: 80, s: 60 }, "b", 30);
    expect(next.b).toBe(40);
    /* c holds more than s, so c surrenders more. That asymmetry is why
       descending order converges and ascending order oscillates — the level's
       honest solve is a property of this arithmetic, not a rule on top of it. */
    expect(80 - next.c!).toBeGreaterThan(60 - next.s!);
  });

  it("gives the change back rather than break the invariant at a stop", () => {
    /* Nothing left to take: the others are already at their floor, so the
       slider cannot climb at all and must not pretend to. */
    const pinned: ControlState = { b: 90, c: 0, s: 0 };
    const next = graph.apply(pinned, "b", 10);
    expect(next).toEqual(pinned);
  });

  it("keeps only as much of a move as the others can pay for", () => {
    /* Six units available between them, ten requested. */
    const next = graph.apply({ b: 40, c: 4, s: 2 }, "b", 10);
    expect(next.b).toBe(46);
    expect(next.c).toBe(0);
    expect(next.s).toBe(0);
    expect(sum(next)).toBe(46);
  });

  it("is honestly reported as having no solve order", () => {
    /* Every control moves every other one, so no move is ever final. Saying
       otherwise would produce a plan that looks valid and is not. */
    expect(solveOrder(graph)).toBeNull();
  });
});

describe("writeback", () => {
  /* A child that overwrites its parent — L39's city → country reverse lookup. */
  const COUNTRY_OF = [0, 0, 1, 1, 2];
  const graph = new CouplingGraph(
    [
      { id: "country", min: 0, max: 2 },
      { id: "city", min: 0, max: 4 },
    ],
    [{ from: "city", to: "country", kind: "writeback", map: (v) => COUNTRY_OF[v] ?? 0 }],
  );

  it("sets the parent from the child, not by a delta", () => {
    const next = graph.set({ country: 2, city: 0 }, "city", 3);
    expect(next.city).toBe(3);
    expect(next.country).toBe(1);
  });

  it("orders the child before the parent it overwrites", () => {
    /* Which is the level's fastest solve read straight off the graph: set the
       city and let it fill the country in for you. */
    expect(solveOrder(graph)).toEqual(["city", "country"]);
  });
});
