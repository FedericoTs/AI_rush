import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/engine/rng";
import { CouplingGraph, type ControlState } from "@/engine/coupling/graph";
import { proveSolvable, scrambleFrom, solveOrder } from "@/engine/coupling/solver";
import { bump, pressesFor } from "./L40ConfirmQuantity";
import { addTag } from "./L45AddSomeTags";
import { behind } from "./L43SelectYourSeats";
import { BUDGET, IDS as DISPLAY_IDS, TARGET as DISPLAY_TARGET, displayGraph, settled } from "./L44DisplaySettings";
import { countryOfCity } from "./L39WhereAreYouLocated";
import { MODULE, offFromTop, pitchRadius, toothPath, trainAngles, trainRatio } from "./L38HumanVerificationRequired/gears";

/**
 * The coupled family's mandatory test (`LEVELS.md`, build notes):
 *
 *   > a solver that proves the seeded start state is reachable to the target in
 *   > ≤ N moves. It runs at deal time in dev and in CI over 10,000 seeds.
 *   > Shipping an unsolvable seed is the single worst failure this game can
 *   > have — it turns the joke into a bug report.
 *
 * Each level below proves its own honest solve, because each has a different
 * one. A topological order is only the right proof where the graph is acyclic;
 * where it is not, saying so and proving convergence instead is the honest
 * answer rather than a weaker one.
 */

const SEEDS = 10_000;

describe("L40 · Confirm Quantity — carry propagates leftward", () => {
  it("settles right to left, every column final once placed", () => {
    const target = [0, 4, 1, 2, 8];
    const rng = mulberry32(99);

    for (let seed = 0; seed < SEEDS; seed++) {
      let digits = Array.from({ length: 5 }, () => Math.floor(rng() * 10));
      /* Rightmost first: a column only ever disturbs columns to its left, so
         after it is placed nothing that follows can move it again. */
      for (let col = 4; col >= 0; col--) {
        /* Counted once, before pressing. Re-reading `digits[col]` in the loop
           condition makes the count shrink as the value climbs, and the two
           meet halfway — which is a bug in the test, not the level. */
        const presses = pressesFor(digits[col]!, target[col]!);
        for (let n = 0; n < presses; n++) digits = bump(digits, col);
      }
      expect(digits, `seed ${seed}`).toEqual(target);
    }
  });

  it("carries into the column on its left, and only leftward", () => {
    expect(bump([1, 2, 9], 2)).toEqual([1, 3, 0]);
    expect(bump([1, 9, 9], 2)).toEqual([2, 0, 0]);
    /* The leftmost wraps and takes nothing with it. */
    expect(bump([9, 0, 0], 0)).toEqual([0, 0, 0]);
  });
});

describe("L43 · Select Your Seats — the chain runs backwards", () => {
  const graph = new CouplingGraph(
    [
      { id: "p1", min: 0, max: 23, wrap: true },
      { id: "p2", min: 0, max: 23, wrap: true },
      { id: "p3", min: 0, max: 23, wrap: true },
    ],
    [
      { from: "p3", to: "p2", kind: "propagate", ratio: 1 },
      { from: "p2", to: "p1", kind: "propagate", ratio: 1 },
    ],
  );

  it("orders the passengers 3, 2, 1 — each placement disturbing only the placed", () => {
    expect(solveOrder(graph)).toEqual(["p3", "p2", "p1"]);
  });

  it("is reachable from every scrambled start", () => {
    const target: ControlState = { p1: 5, p2: 10, p3: 18 };
    const rng = mulberry32(7);
    for (let seed = 0; seed < SEEDS; seed++) {
      const start = scrambleFrom(graph, target, 5, rng);
      const proof = proveSolvable(graph, start, target);
      expect(proof.solvable, `seed ${seed}: ${proof.reason}`).toBe(true);
    }
  });

  it("puts the relocated passenger directly behind, wrapping at the back row", () => {
    expect(behind(0)).toBe(4);
    expect(behind(20)).toBe(0);
  });
});

describe("L45 · Add Some Tags — least recently added is evicted", () => {
  const wanted = ["Hiking", "Ceramics", "Jazz", "Sourdough"];

  it("keeps the last four added consecutively, which is the honest solve", () => {
    let tags = ["Synergy", "Blockchain", "Growth", "Hustle"];
    for (const w of wanted) tags = addTag(tags, w);
    expect(tags).toEqual(wanted);
  });

  it("throws out your own work if you dither", () => {
    /* Adding a wrong tag between correct ones costs you the earliest one. */
    let tags = ["Synergy", "Blockchain", "Growth", "Hustle"];
    tags = addTag(tags, "Hiking");
    tags = addTag(tags, "Cycling");
    tags = addTag(tags, "Ceramics");
    tags = addTag(tags, "Podcasts");
    tags = addTag(tags, "Jazz");
    expect(tags).not.toContain("Hiking");
  });

  it("never grows past four, and ignores a duplicate", () => {
    let tags = ["a", "b", "c", "d"];
    tags = addTag(tags, "a");
    expect(tags).toEqual(["a", "b", "c", "d"]);
  });
});

describe("L46 · Choose Your Dates — From drags To", () => {
  const graph = new CouplingGraph(
    [
      { id: "from", min: 1, max: 28 },
      { id: "to", min: 1, max: 28 },
    ],
    [{ from: "from", to: "to", kind: "propagate", ratio: 1 }],
  );

  it("says the order is From then To", () => {
    expect(solveOrder(graph)).toEqual(["from", "to"]);
  });

  it("preserves the gap when From moves and changes it when To moves", () => {
    const gap = (s: ControlState) => s.to! - s.from!;
    const start: ControlState = { from: 3, to: 8 };
    expect(gap(graph.set(start, "from", 11))).toBe(5);
    expect(gap(graph.set(start, "to", 25))).toBe(22);
  });

  it("reaches the requested range in two moves, from anywhere", () => {
    const target: ControlState = { from: 11, to: 25 };
    for (let from = 1; from <= 28; from++) {
      for (let to = from; to <= 28; to++) {
        const proof = proveSolvable(graph, { from, to }, target);
        expect(proof.solvable, `start ${from}–${to}: ${proof.reason}`).toBe(true);
        expect(proof.plan!.moves.length).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("L44 · Display Settings — a simplex, not an ordering", () => {
  const graph = displayGraph();

  it("is honest that no ordering makes a move final here", () => {
    expect(solveOrder(graph)).toBeNull();
  });

  /*
   * So the proof is convergence rather than a plan: a player who sets the
   * largest target first and works down lands inside tolerance. This *is* the
   * honest solve from `LEVELS.md`, simulated — if it stopped converging the
   * level would have no route through and this would fail.
   */
  it("converges from every seeded start when approached largest-first", () => {
    const descending = [...DISPLAY_IDS].sort((a, b) => DISPLAY_TARGET[b]! - DISPLAY_TARGET[a]!);
    const rng = mulberry32(4242);

    for (let seed = 0; seed < 2000; seed++) {
      const a = 20 + Math.floor(rng() * 71);
      const b = 10 + Math.floor(rng() * Math.max(1, BUDGET - a - 20));
      let state: ControlState = { brightness: a, contrast: b, saturation: BUDGET - a - b };

      /* A few sweeps down the list, exactly as a player would. */
      for (let round = 0; round < 8 && !settled(state); round++) {
        for (const id of descending) {
          state = graph.apply(state, id, DISPLAY_TARGET[id]! - state[id]!);
        }
      }
      expect(settled(state), `seed ${seed}: ${JSON.stringify(state)}`).toBe(true);
    }
  });

  /*
   * And the claim that is *not* true, kept as a test so nobody re-adds it.
   *
   * `LEVELS.md` says descending order converges while ascending oscillates.
   * With the sum pinned and three controls there are two degrees of freedom, so
   * fixing two fixes the third whichever way round you go — and both orders
   * land in an identical number of sweeps. The level ships the property the
   * arithmetic really has instead; see the comment on its Component.
   */
  it("converges just as well smallest-first, which is why the level teaches something else", () => {
    const ascending = [...DISPLAY_IDS].sort((a, b) => DISPLAY_TARGET[a]! - DISPLAY_TARGET[b]!);
    const rng = mulberry32(4242);

    for (let seed = 0; seed < 500; seed++) {
      const a = 20 + Math.floor(rng() * 71);
      const b = 10 + Math.floor(rng() * Math.max(1, BUDGET - a - 20));
      let state: ControlState = { brightness: a, contrast: b, saturation: BUDGET - a - b };
      for (let round = 0; round < 8 && !settled(state); round++) {
        for (const id of ascending) {
          state = graph.apply(state, id, DISPLAY_TARGET[id]! - state[id]!);
        }
      }
      expect(settled(state), `seed ${seed}`).toBe(true);
    }
  });

  it("needs a second pass, because placing one moves the one before it", () => {
    /* The reason this is a convergence task and not a two-move puzzle: fixing
       the sum means the third value is *determined*, but redistribution pulls
       on everything, so one sweep is never quite enough. */
    let state: ControlState = { brightness: 30, contrast: 30, saturation: BUDGET - 60 };
    state = graph.apply(state, "brightness", DISPLAY_TARGET.brightness! - state.brightness!);
    state = graph.apply(state, "contrast", DISPLAY_TARGET.contrast! - state.contrast!);
    expect(settled(state)).toBe(false);

    let sweeps = 0;
    while (!settled(state) && sweeps < 8) {
      for (const id of DISPLAY_IDS) state = graph.apply(state, id, DISPLAY_TARGET[id]! - state[id]!);
      sweeps++;
    }
    expect(settled(state)).toBe(true);
    /* A handful, not one — which is exactly the shape of a convergence task. */
    expect(sweeps).toBeGreaterThan(0);
    expect(sweeps).toBeLessThanOrEqual(4);
  });

  it("keeps the budget exactly, however it is pushed around", () => {
    const rng = mulberry32(11);
    let state: ControlState = { brightness: 50, contrast: 50, saturation: 50 };
    for (let i = 0; i < 5000; i++) {
      const id = DISPLAY_IDS[Math.floor(rng() * DISPLAY_IDS.length)]!;
      state = graph.apply(state, id, Math.floor(rng() * 61) - 30);
      const total = DISPLAY_IDS.reduce((n, x) => n + state[x]!, 0);
      expect(total, `step ${i}`).toBe(BUDGET);
    }
  });
});

describe("L39 · Where Are You Located? — the reverse lookup", () => {
  it("knows which country every city belongs to", () => {
    expect(countryOfCity("Kyoto")).toBe("Japan");
    expect(countryOfCity("Venice")).toBe("Italy");
    expect(countryOfCity("Atlantis")).toBeNull();
  });
});

describe("L38 · Human Verification Required — the gears actually mesh", () => {
  const TEETH = [7, 12, 9, 14, 11, 49];

  it("inverts direction at every mesh and scales by the tooth ratio", () => {
    /* Two gears: one turn of a 7T drives 7/49 of a turn of a 49T, backwards. */
    expect(trainRatio([7, 49])).toBeCloseTo(-1 / 7, 10);
    /* Five meshes, so five inversions: the output runs backwards. */
    expect(trainRatio(TEETH)).toBeLessThan(0);
  });

  it("reduces by exactly seven, which is the level", () => {
    /* A long drag for a small correction, in the wrong direction. */
    expect(Math.abs(trainRatio(TEETH))).toBeCloseTo(1 / 7, 10);
    const angles = trainAngles(TEETH, 1);
    expect(Math.abs(angles[angles.length - 1]!)).toBeCloseTo(1 / 7, 10);
  });

  it("ignores the idlers, because a simple train only cares about its ends", () => {
    /* The fact printed in the specifications footer, asserted rather than
       claimed: swap every gear in the middle and the ratio does not move. */
    expect(Math.abs(trainRatio([7, 12, 9, 14, 11, 49])))
      .toBeCloseTo(Math.abs(trainRatio([7, 31, 22, 8, 40, 49])), 10);
  });

  it("meshes: adjacent pitch circles touch, so teeth engage rather than float", () => {
    for (let i = 1; i < TEETH.length; i++) {
      const gap = pitchRadius(TEETH[i - 1]!) + pitchRadius(TEETH[i]!);
      /* Centre distance is the sum of pitch radii — the definition of a mesh. */
      expect(gap).toBeCloseTo((MODULE * (TEETH[i - 1]! + TEETH[i]!)) / 2, 10);
    }
  });

  it("draws one closed outline with four samples per tooth", () => {
    const path = toothPath({ cx: 0, cy: 0, teeth: 9, phase: 0 });
    expect(path).toHaveLength(9 * 4);
    const radii = path.map(([x, y]) => Math.hypot(x, y));
    /* Tips stand proud of the pitch circle, roots sit inside it. */
    expect(Math.max(...radii)).toBeGreaterThan(pitchRadius(9));
    expect(Math.min(...radii)).toBeLessThan(pitchRadius(9));
  });

  it("measures the marked tooth against the top, signed and wrapped", () => {
    expect(offFromTop(-Math.PI / 2)).toBeCloseTo(0, 10);
    expect(Math.abs(offFromTop(Math.PI / 2))).toBeCloseTo(Math.PI, 10);
  });
});
